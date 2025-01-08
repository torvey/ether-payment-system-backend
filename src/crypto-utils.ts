import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Musi mieć 32 bajty
const IV_LENGTH = 16; // Długość wektora inicjalizacyjnego

export function encrypt(text: string): string {
  console.log('ENCRYPTION_KEY:', ENCRYPTION_KEY);

  if (!ENCRYPTION_KEY) {
    console.log('ENCRYPTION_KEY is not set');
    return;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    console.log('ENCRYPTION_KEY is not set');
    return;
  }

  const [iv, encryptedText] = text.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, 'hex'),
  );
  let decrypted = decipher.update(Buffer.from(encryptedText, 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
