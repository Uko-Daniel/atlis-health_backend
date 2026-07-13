import { prisma } from '../lib/prisma';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// ── OAuth URL Generation ──────────────────────────────────────

export function getAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
    ],
    state,
  });
}

// ── Token Exchange ────────────────────────────────────────────

export async function handleCallback(code: string): Promise<{ tokens: any }> {
  const { tokens } = await oauth2Client.getToken(code);
  return { tokens };
}

// ── Token Storage ─────────────────────────────────────────────

export async function storeTokens(
  staffId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: number,
  scope: string,
) {
  const expiry = new Date(expiryDate);

  return prisma.googleCredential.upsert({
    where: { staffId },
    update: {
      accessToken,
      refreshToken,
      tokenExpiry: expiry,
      scope,
    },
    create: {
      staffId,
      accessToken,
      refreshToken,
      tokenExpiry: expiry,
      scope,
    },
  });
}

// ── Token Retrieval & Refresh ─────────────────────────────────

async function getAuthenticatedClient(staffId: string) {
  const cred = await prisma.googleCredential.findUnique({
    where: { staffId },
  });

  if (!cred) throw new Error('No Google credentials found for this staff member');

  oauth2Client.setCredentials({
    access_token: cred.accessToken,
    refresh_token: cred.refreshToken,
    expiry_date: cred.tokenExpiry.getTime(),
  });

  // Auto-refresh if expired
  if (cred.tokenExpiry <= new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await storeTokens(
      staffId,
      credentials.access_token!,
      credentials.refresh_token ?? cred.refreshToken,
      credentials.expiry_date!,
      credentials.scope ?? cred.scope,
    );
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

// ── Calendar: Create Event with Meet Link ─────────────────────

export async function createCalendarEvent(
  staffId: string,
  event: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
  },
): Promise<{ eventId: string; meetLink: string | null }> {
  const auth = await getAuthenticatedClient(staffId);
  const calendar = google.calendar({ version: 'v3', auth });

  const requestBody: calendar_v3.Schema$Event = {
    summary: event.summary,
    start: { dateTime: event.startTime, timeZone: 'Africa/Lagos' },
    end: { dateTime: event.endTime, timeZone: 'Africa/Lagos' },
    conferenceData: {
      createRequest: {
        requestId: `atlis-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  if (event.description !== undefined) {
    requestBody.description = event.description;
  }

  if (event.attendees?.length) {
    requestBody.attendees = event.attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody,
  });

  return {
    eventId: response.data.id!,
    meetLink: response.data.hangoutLink ?? response.data.conferenceData?.entryPoints?.[0]?.uri ?? null,
  };
}

// ── Drive: Upload File ────────────────────────────────────────

export async function uploadToDrive(
  staffId: string,
  file: { name: string; mimeType: string; content: Buffer },
  folderName = 'Atlis Referrals',
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = await getAuthenticatedClient(staffId);
  const drive = google.drive({ version: 'v3', auth });

  // Find or create folder
  let folderId: string;
  const folderQuery = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  const existingFolder = folderQuery.data.files?.[0];
  if (existingFolder?.id) {
    folderId = existingFolder.id;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
    });
    folderId = folder.data.id!;
  }

  // Upload file
  const uploaded = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimeType,
      body: file.content,
    },
  });

  return {
    fileId: uploaded.data.id!,
    webViewLink: `https://drive.google.com/file/d/${uploaded.data.id}/view`,
  };
}

// ── Check Connection Status ───────────────────────────────────

export async function getConnectionStatus(staffId: string): Promise<{
  connected: boolean;
  expiryDate: Date | null;
}> {
  const cred = await prisma.googleCredential.findUnique({
    where: { staffId },
    select: { tokenExpiry: true },
  });

  return {
    connected: !!cred,
    expiryDate: cred?.tokenExpiry ?? null,
  };
}

// ── Disconnect ────────────────────────────────────────────────

export async function disconnect(staffId: string): Promise<void> {
  const cred = await prisma.googleCredential.findUnique({ where: { staffId } });
  if (!cred) return;

  try {
    const auth = await getAuthenticatedClient(staffId);
    await auth.revokeToken(cred.accessToken);
  } catch {
    // Token may already be invalid — proceed with DB cleanup
  }

  await prisma.googleCredential.delete({ where: { staffId } });
}
