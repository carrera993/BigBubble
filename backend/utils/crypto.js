// utils/crypto.js
// Cifrado simétrico AES-256-GCM para proteger datos sensibles (ej: email) en la base de datos.
// Las contraseñas NUNCA se cifran: se hashean con bcrypt (ver routes/auth.js), que es
// el método correcto y de una sola vía para credenciales.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM

function getKey() {
  const secret = process.env.JWT_SECRET || 'dev_only_change_me';
  // Derivamos una clave de 32 bytes a partir del secreto configurado.
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Empaquetamos iv + authTag + datos cifrados en un solo string base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payloadB64) {
  const key = getKey();
  const data = Buffer.from(payloadB64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = data.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
