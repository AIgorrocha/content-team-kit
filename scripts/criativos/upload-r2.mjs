#!/usr/bin/env node
/**
 * upload-r2.mjs - sobe criativo (qualquer cliente) pro Cloudflare R2 (S3-compativel).
 *
 * O publisher le o R2 em pub-...r2.dev/social/. Este script poe os
 * assets gerados no prefixo `social/gen/` pra alimentar os pools do publisher.
 *
 * Env necessarios (documentados aqui; NUNCA commitar):
 *   R2_ACCOUNT_ID         id da conta Cloudflare
 *   R2_ACCESS_KEY_ID      chave de acesso R2
 *   R2_SECRET_ACCESS_KEY  segredo R2
 *   R2_BUCKET             nome do bucket (ex: blueocean)
 *   (opcional) R2_ENDPOINT  sobrescreve o endpoint padrao
 *
 * GATE (dry-run): se faltar env, imprime o que falta e sai 0 SEM erro.
 * So sobe de verdade quando todas as chaves estao presentes.
 *
 * Uso:  node scripts/criativos/upload-r2.mjs <arquivo> [--key social/gen/nome.mp4]
 * Programatico:  import { uploadR2 } from "./upload-r2.mjs"
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env" });
import { readFileSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";

const PREFIX = "social/gen/";
const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function r2EnvStatus() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  return { ready: missing.length === 0, missing };
}

/**
 * Sobe um arquivo. Se env faltar -> dry-run (retorna { skipped:true }), sem lancar.
 */
export async function uploadR2(file, key) {
  const { ready, missing } = r2EnvStatus();
  const finalKey = key || PREFIX + basename(file);
  if (!ready) {
    console.log(`[upload-r2] DRY-RUN (env faltando: ${missing.join(", ")})`);
    console.log(`[upload-r2] subiria: ${file} -> r2://${process.env.R2_BUCKET || "<bucket>"}/${finalKey}`);
    return { skipped: true, missing, key: finalKey };
  }
  if (!existsSync(file)) throw new Error(`arquivo nao existe: ${file}`);

  // import dinamico pra dry-run nao exigir o pacote instalado
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const endpoint =
    process.env.R2_ENDPOINT ||
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const body = readFileSync(file);
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()] || "application/octet-stream";
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: finalKey,
      Body: body,
      ContentType: contentType,
    })
  );
  console.log(`[upload-r2] OK -> r2://${process.env.R2_BUCKET}/${finalKey}`);
  return { skipped: false, key: finalKey, contentType, bytes: body.length };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("upload-r2.mjs")) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const ki = args.indexOf("--key");
  const key = ki >= 0 ? args[ki + 1] : null;
  if (!file) {
    const { ready, missing } = r2EnvStatus();
    console.log(`uso: node upload-r2.mjs <arquivo> [--key ${PREFIX}nome.mp4]`);
    console.log(`env R2: ${ready ? "pronto" : "faltando " + missing.join(", ")}`);
    process.exit(0);
  }
  uploadR2(file, key)
    .then(() => process.exit(0))
    .catch((e) => { console.error("[upload-r2] erro:", e.message); process.exit(1); });
}
