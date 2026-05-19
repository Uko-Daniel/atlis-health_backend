import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = process.env.RESULT_ENCRYPTION_KEY || '32charslongsecretkey1234567890ab';
const IV_LENGTH = 16;

export const encryptJSON = (data: any): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decryptJSON = (encryptedData: string): any => {
  const [ivHex, dataHex] = encryptedData.split(':');
  if (!ivHex || !dataHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
};
