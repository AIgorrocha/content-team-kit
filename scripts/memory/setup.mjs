#!/usr/bin/env node
// Sobe a memoria dos agentes (ai-memory) desta empresa. Idempotente: pode rodar de novo.
// Uso: npm run memory:setup [-- --no-docker] [--no-bin]
// Ver integrations/ai-memory/README.md
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = join(ROOT, "integrations/ai-memory");
const ENV = join(DIR, ".env");
const BIN_DIR = join(DIR, "bin");
const VERSION = "1.38.0"; // mesma da imagem no docker-compose.yml
const URL = "http://127.0.0.1:49374";
const args = process.argv.slice(2);
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
const has = (cmd) => { try { sh(cmd); return true; } catch { return false; } };

// 1. token + .env (nunca sobrescreve um token existente)
let token;
if (existsSync(ENV)) {
  token = (readFileSync(ENV, "utf8").match(/^AI_MEMORY_AUTH_TOKEN=(.+)$/m) || [])[1]?.trim();
}
if (!token || token === "troque-por-token-gerado") {
  token = randomBytes(32).toString("hex");
  const example = readFileSync(join(DIR, ".env.example"), "utf8");
  writeFileSync(ENV, example.replace(/^AI_MEMORY_AUTH_TOKEN=.*$/m, `AI_MEMORY_AUTH_TOKEN=${token}`));
  console.log(`[1/4] token gerado e gravado em ${ENV} (gitignored)`);
} else console.log(`[1/4] .env ja existe, token mantido`);

// 2. Ollama (opcional)
const ollama = has("ollama list");
if (ollama) {
  const list = sh("ollama list");
  if (!/nomic-embed-text/.test(list)) console.log("      Ollama encontrado. Rode: ollama pull nomic-embed-text  (busca semantica)");
  else console.log("[2/4] Ollama com nomic-embed-text: busca semantica ligada");
} else console.log("[2/4] Ollama nao encontrado: memoria em modo degradado (so texto). Ver README pra ligar depois");

// 3. Docker
if (!args.includes("--no-docker")) {
  if (!has("docker info")) { console.log("[3/4] Docker nao esta rodando. Abra o Docker Desktop e rode de novo."); process.exit(1); }
  sh("docker compose up -d", { cwd: DIR, stdio: "inherit" });
  console.log(`[3/4] container ai-memory no ar em ${URL}`);
}

// 4. binario da CLI (hooks + bridge MCP)
const exe = process.platform === "win32" ? "ai-memory.exe" : "ai-memory";
const bin = join(BIN_DIR, exe);
if (!args.includes("--no-bin") && !existsSync(bin)) {
  const asset = { win32: "ai-memory-windows-x86_64.zip", linux: "ai-memory-linux-x86_64.tar.gz", darwin: "ai-memory-macos-aarch64.tar.gz" }[process.platform];
  const dl = `https://github.com/akitaonrails/ai-memory/releases/download/v${VERSION}/${asset}`;
  mkdirSync(BIN_DIR, { recursive: true });
  const pkg = join(BIN_DIR, asset);
  sh(`curl -sSL -o "${pkg}" "${dl}"`);
  if (asset.endsWith(".zip")) sh(`tar -xf "${pkg}" -C "${BIN_DIR}"`); else sh(`tar -xzf "${pkg}" -C "${BIN_DIR}"`);
  console.log(`[4/4] CLI ai-memory ${VERSION} em ${bin}`);
} else console.log(`[4/4] CLI ${existsSync(bin) ? "ja instalada" : "pulada (--no-bin)"}`);

// Instrucoes finais. O token nao e impresso.
const q = (s) => JSON.stringify(s);
const hook = (ev, t) => ({ hooks: [{ type: "command", timeout: t, command: `${q(bin)} hook --event ${ev} --agent claude-code --server-url ${URL} --auth-token $AI_MEMORY_AUTH_TOKEN` }] });
const hooks = {
  SessionStart: [hook("session-start", 15)], UserPromptSubmit: [hook("user-prompt-submit", 10)],
  Stop: [hook("stop", 20)], PreCompact: [hook("pre-compact", 20)], SessionEnd: [hook("session-end", 20)],
};
const snippet = join(DIR, "claude-hooks.snippet.json");
writeFileSync(snippet, JSON.stringify({ hooks }, null, 2) + "\n");
console.log(`
Proximos passos (uma vez, na sua maquina):
1. Registrar o MCP no Claude Code (token lido do .env, nao cole na mao):
   claude mcp add --scope user ai-memory -e AI_MEMORY_SERVER_URL=${URL}/mcp -e AI_MEMORY_AUTH_TOKEN=<token do ${ENV}> -- ${q(bin)} mcp-bridge --server-url ${URL}/mcp
2. Hooks de captura automatica: copie o bloco de ${snippet} pra ~/.claude/settings.json
   (trocando $AI_MEMORY_AUTH_TOKEN pelo token, ou exporte a variavel no seu perfil).
3. Abra uma sessao nova e teste: "memory_query: regras da marca".
`);
