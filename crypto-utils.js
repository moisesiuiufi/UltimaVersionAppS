const crypto = require('crypto');

function encryptData(data, password) {
  const iv = crypto.randomBytes(12);
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encoded = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = Buffer.concat([cipher.update(encoded), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: Array.from(iv),
    salt: Array.from(salt),
    ciphertext: Array.from(Buffer.concat([encrypted, tag]))
  };
}

function decryptData(encrypted, password) {
  const iv = Buffer.from(encrypted.iv);
  const salt = Buffer.from(encrypted.salt);
  const ciphertextWithTag = Buffer.from(encrypted.ciphertext);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  const tag = ciphertextWithTag.slice(-16);
  const ciphertext = ciphertextWithTag.slice(0, -16);

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { encryptData, decryptData };

