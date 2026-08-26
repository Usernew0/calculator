import QRCode from 'qrcode';

// Base32 alphabet according to RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a Uint8Array into a Base32 string (without padding)
 */
export function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a Uint8Array
 */
export function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s\-=]/g, '');
  let bits = 0;
  let value = 0;
  const result: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(result);
}

/**
 * Generates a random Base32 secret key (160-bit / 20 bytes standard for TOTP)
 */
export function generateTotpSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Node.js or fallback
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return base32Encode(bytes);
}

/**
 * Formats a TOTP secret into groups of 4 for readability (e.g. ABCD EFGH 1234 5678)
 */
export function formatTotpSecret(secret: string): string {
  const clean = secret.replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Generates standard key URI for Authenticator apps (Google Authenticator, Microsoft Authenticator, Authy)
 */
export function generateTotpUri(username: string, secret: string, issuer = 'ElegantFX Landed Cost'): string {
  const cleanUsername = encodeURIComponent(username.trim());
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${cleanIssuer}:${cleanUsername}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates QR Code Data URL for an otpauth URI
 */
export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Code Data URL:', err);
    return '';
  }
}

/**
 * Generates a set of single-use emergency backup recovery codes
 */
export function generateBackupCodes(count = 6): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars[Math.floor(Math.random() * chars.length)];
      part2 += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Normalizes user input for security / emergency backup codes:
 * Strips whitespace, hyphens, en-dashes, em-dashes, underscores and converts to uppercase
 */
export function normalizeSecurityCode(input: string): string {
  if (!input) return '';
  return String(input)
    .toUpperCase()
    .trim()
    .replace(/[\s\-_—–]/g, '');
}

/**
 * Verifies if an entered code matches any code in the backup codes array.
 * Returns the matching index or -1 if not found.
 */
export function matchBackupCodeIndex(enteredCode: string, backupCodes: string[]): number {
  if (!enteredCode || !Array.isArray(backupCodes) || backupCodes.length === 0) {
    return -1;
  }
  const normalizedInput = normalizeSecurityCode(enteredCode);
  if (!normalizedInput) return -1;
  return backupCodes.findIndex((code) => normalizeSecurityCode(code) === normalizedInput);
}

/**
 * Calculates HMAC-SHA1 using Web Crypto API or pure fallback
 */
async function hmacSha1(keyBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
    return new Uint8Array(signature);
  }

  // Fallback for Node environment if needed
  try {
    const nodeCrypto = await import('crypto');
    const hmac = nodeCrypto.createHmac('sha1', Buffer.from(keyBytes));
    hmac.update(Buffer.from(messageBytes));
    return new Uint8Array(hmac.digest());
  } catch {
    throw new Error('No crypto implementation available for HMAC-SHA1');
  }
}

/**
 * Generates the current 6-digit TOTP code for a secret and timestamp
 */
export async function generateTotpCode(secret: string, timestampMs = Date.now(), period = 30): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / period);

  // Convert counter to 8-byte big-endian buffer
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const hash = await hmacSha1(keyBytes, counterBytes);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret with clock drift window (+/- window steps)
 */
export async function verifyTotpCode(
  token: string,
  secret: string,
  window = 1,
  timestampMs = Date.now(),
  period = 30
): Promise<boolean> {
  const cleanToken = token.replace(/[\s-]/g, '').trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  for (let offset = -window; offset <= window; offset++) {
    const checkTime = timestampMs + offset * period * 1000;
    const generated = await generateTotpCode(secret, checkTime, period);
    if (generated === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Gets remaining seconds in the current 30-second TOTP window
 */
export function getTotpRemainingSeconds(period = 30): number {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}
