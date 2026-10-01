import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "checar-chaves.mjs");
const SEGREDO = "SEGREDO-super-secreto-123";

function rodar(dir, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" });
}
const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), "chaves-"));

test("diz preenchida ou vazia e nunca mostra o valor", () => {
  const dir = pasta();
  fs.writeFileSync(path.join(dir, ".env.local"), `TELEGRAM_BOT_TOKEN=${SEGREDO}\nTELEGRAM_CHAT_ID=\n`);
  const r = rodar(dir, "--rede", "telegram");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /TELEGRAM_BOT_TOKEN: preenchida/);
  assert.match(r.stdout, /TELEGRAM_CHAT_ID: vazia/);
  for (const parte of [SEGREDO, "SEGREDO", "super", "123", String(SEGREDO.length)]) {
    assert.ok(!(r.stdout + r.stderr).includes(parte), `vazou: ${parte}`);
  }
});

test("--criar acrescenta so o que falta e nao sobrescreve valor existente", () => {
  const dir = pasta();
  const arq = path.join(dir, ".env.local");
  fs.writeFileSync(arq, `TELEGRAM_BOT_TOKEN=${SEGREDO}`); // sem quebra de linha final
  const r = rodar(dir, "--rede", "telegram", "--criar");
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(arq, "utf8"), `TELEGRAM_BOT_TOKEN=${SEGREDO}\nTELEGRAM_CHAT_ID=\n`);
  assert.ok(!r.stdout.includes(SEGREDO));
});

test("--criar cria o arquivo quando nao existe", () => {
  const dir = pasta();
  const r = rodar(dir, "YOUTUBE_CLIENT_ID", "--criar");
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(path.join(dir, ".env.local"), "utf8"), "YOUTUBE_CLIENT_ID=\n");
  assert.match(r.stdout, /YOUTUBE_CLIENT_ID: vazia/);
});

test("rede desconhecida falha com mensagem", () => {
  const r = rodar(pasta(), "--rede", "orkut");
  assert.equal(r.status, 2);
});
