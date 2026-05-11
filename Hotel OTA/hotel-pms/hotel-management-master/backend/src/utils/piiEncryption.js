import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * PII Encryption utility for sensitive personal data.
 * Uses AES-256-CBC for at-rest encryption of passport numbers, Aadhaar, PAN, etc.
 */
class PIIEncryption {
  constructor(encryptionKey) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters. Set it in .env');
    }
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  encrypt(plainText) {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encryptedText; // Return as-is if decryption fails (already plain?)
    }
  }

  mask(value, visibleChars = 4) {
    if (!value) return value;
    const plain = this.isEncrypted(value) ? this.decrypt(value) : value;
    if (plain.length <= visibleChars) return '****';
    return '****' + plain.slice(-visibleChars);
  }

  isEncrypted(value) {
    return typeof value === 'string' && /^[0-9a-f]{32}:[0-9a-f]+$/.test(value);
  }
}

// Singleton instance
let instance = null;

const getPIIEncryption = () => {
  if (!instance) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('FATAL: ENCRYPTION_KEY environment variable is required for PII encryption. Set it in .env');
    }
    instance = new PIIEncryption(key);
  }
  return instance;
};

export { PIIEncryption, getPIIEncryption };
