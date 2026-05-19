import { prisma } from '../lib/prisma';

// ── CONFIG ────────────────────────────────────────────────────

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ── TYPES ─────────────────────────────────────────────────────

export interface LockState {
  locked:    boolean;
  lockedBy:  string | null;
  lockedAt:  Date   | null;
  expiresAt: Date   | null;
  isExpired: boolean;
  ownedBy:   (staffId: string) => boolean;
}

export interface AcquireLockResult {
  success:   boolean;
  lock:      LockState;
  error?:    string;
}

// ── HELPERS ───────────────────────────────────────────────────

function buildLockState(
  lockedBy: string | null,
  lockedAt: Date   | null,
): LockState {
  const expiresAt = lockedAt
    ? new Date(lockedAt.getTime() + LOCK_DURATION_MS)
    : null;

  const isExpired = expiresAt ? expiresAt < new Date() : false;

  return {
    locked:    !!lockedBy && !isExpired,
    lockedBy:  lockedBy,
    lockedAt:  lockedAt,
    expiresAt: expiresAt,
    isExpired: isExpired,
    ownedBy:   (staffId: string) => lockedBy === staffId && !isExpired,
  };
}

// ── LOCK FUNCTIONS ────────────────────────────────────────────

/**
 * Attempt to acquire an edit lock on a result.
 * Fails if another staff member holds a non-expired lock.
 * If the existing lock is expired, it is forcibly taken.
 */
export async function acquireLock(
  resultId: string,
  staffId:  string,
): Promise<AcquireLockResult> {
  const result = await prisma.result.findUnique({
    where:  { id: resultId },
    select: { id: true, lockedBy: true, lockedAt: true, status: true },
  });

  if (!result) {
    return {
      success: false,
      lock:    buildLockState(null, null),
      error:   'Result not found',
    };
  }

  // Finalized results cannot be edited
  if (result.status === 'FINALIZED') {
    return {
      success: false,
      lock:    buildLockState(result.lockedBy, result.lockedAt),
      error:   'Result is finalized and cannot be edited',
    };
  }

  const currentLock = buildLockState(result.lockedBy, result.lockedAt);

  // Lock held by someone else and not expired
  if (currentLock.locked && result.lockedBy !== staffId) {
    return {
      success: false,
      lock:    currentLock,
      error:   `Result is currently being edited by another user. Lock expires at ${currentLock.expiresAt?.toISOString()}`,
    };
  }

  // Acquire — either unlocked, expired, or already owned by this staff
  const now = new Date();

  await prisma.result.update({
    where: { id: resultId },
    data:  { lockedBy: staffId, lockedAt: now },
  });

  return {
    success: true,
    lock:    buildLockState(staffId, now),
  };
}

/**
 * Release a lock. Only the lock owner can release it.
 * Admins can force-release by passing force = true.
 */
export async function releaseLock(
  resultId: string,
  staffId:  string,
  force     = false,
): Promise<void> {
  const result = await prisma.result.findUnique({
    where:  { id: resultId },
    select: { lockedBy: true, lockedAt: true },
  });

  if (!result) throw new Error('Result not found');

  const currentLock = buildLockState(result.lockedBy, result.lockedAt);

  if (!force && currentLock.locked && result.lockedBy !== staffId) {
    throw new Error('Cannot release a lock you do not own');
  }

  await prisma.result.update({
    where: { id: resultId },
    data:  { lockedBy: null, lockedAt: null },
  });
}

/**
 * Refresh (extend) an existing lock.
 * Called on a heartbeat from the result editor — every ~5 minutes.
 * Prevents auto-expiry while a tech is actively editing.
 */
export async function refreshLock(
  resultId: string,
  staffId:  string,
): Promise<LockState> {
  const result = await prisma.result.findUnique({
    where:  { id: resultId },
    select: { lockedBy: true, lockedAt: true },
  });

  if (!result) throw new Error('Result not found');

  if (result.lockedBy !== staffId) {
    throw new Error('Cannot refresh a lock you do not own');
  }

  const now = new Date();

  await prisma.result.update({
    where: { id: resultId },
    data:  { lockedAt: now },
  });

  return buildLockState(staffId, now);
}

/**
 * Check lock state without modifying anything.
 * Used by the frontend to check if a result is editable before opening.
 */
export async function getLockState(resultId: string): Promise<LockState> {
  const result = await prisma.result.findUnique({
    where:  { id: resultId },
    select: { lockedBy: true, lockedAt: true },
  });

  if (!result) throw new Error('Result not found');

  return buildLockState(result.lockedBy, result.lockedAt);
}

/**
 * Assert that staffId owns the lock on resultId.
 * Throws a descriptive error if not — used inside services
 * before any write operation on a result.
 */
export async function assertLockOwner(
  resultId: string,
  staffId:  string,
): Promise<void> {
  const result = await prisma.result.findUnique({
    where:  { id: resultId },
    select: { lockedBy: true, lockedAt: true },
  });

  if (!result) throw new Error('Result not found');

  const lock = buildLockState(result.lockedBy, result.lockedAt);

  if (!lock.locked) {
    throw new Error('No active lock on this result — open an edit session first');
  }

  if (result.lockedBy !== staffId) {
    throw new Error('You do not own the edit lock on this result');
  }

  if (lock.isExpired) {
    throw new Error('Your edit session has expired — please reopen the result');
  }
}

/**
 * Sweep and clear all expired locks across all results.
 * Target this with a cron job — e.g. every 15 minutes.
 * Returns count of locks cleared.
 */
export async function cleanExpiredLocks(): Promise<number> {
  const expiryThreshold = new Date(Date.now() - LOCK_DURATION_MS);

  const { count } = await prisma.result.updateMany({
    where: {
      lockedBy:  { not: null },
      lockedAt:  { lt: expiryThreshold },
    },
    data: {
      lockedBy: null,
      lockedAt: null,
    },
  });

  return count;
}