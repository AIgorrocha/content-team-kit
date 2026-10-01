import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters")
  }
  return Buffer.from(key.slice(0, 32), "utf-8")
}

export function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, "utf-8", "base64")
  encrypted += cipher.final("base64")
  const authTag = cipher.getAuthTag().toString("base64")

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag,
  }
}

export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"), {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(Buffer.from(authTag, "base64"))

  let decrypted = decipher.update(encrypted, "base64", "utf-8")
  decrypted += decipher.final("utf-8")
  return decrypted
}
