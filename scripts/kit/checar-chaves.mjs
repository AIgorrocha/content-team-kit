#!/usr/bin/env node
// Diz, para cada variavel do .env.local, so "preenchida" ou "vazia".
// NUNCA imprime valor, pedaco de valor nem tamanho.
//
// Uso:
//   node scripts/kit/checar-chaves.mjs NOME1 NOME2
//   node scripts/kit/checar-chaves.mjs --rede instagram
//   node scripts/kit/checar-chaves.mjs --rede linkedin --criar   (acrescenta "NOME=" que faltar)
// O arquivo lido e o .env.local da pasta onde o comando roda.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REDES = {
  instagram: ["IG_APP_ID", "INSTAGRAM_APP_SECRET", "IG_OAUTH_CLIENT_ID", "IG_OAUTH_CLIENT_SECRET", "INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"],
  threads: ["THREADS_USER_ID", "THREADS_ACCESS_TOKEN"],
  "meta-ads": ["IG_APP_ID", "INSTAGRAM_APP_SECRET", "META_ACCESS_TOKEN"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_ID"],
  youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN"],
  x: ["X_HANDLE"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"],
  painel: ["SALA_OAUTH_ORIGIN", "CREDENTIALS_ENCRYPTION_KEY"],
};

const NOME_VALIDO = /^[A-Z][A-Z0-9_]*$/;

// Le o arquivo e devolve um Map nome -> true se tem valor. O valor em si nao sai daqui.
function lerPreenchidas(texto) {
  const preenchidas = new Map();
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!m) continue;
    let valor = m[2].trim();
    if (/^(["']).*\1$/.test(valor)) valor = valor.slice(1, -1).trim();
    preenchidas.set(m[1], valor.length > 0);
  }
  return preenchidas;
}

export function checar(nomes, { criar = false, arquivo = path.resolve(".env.local") } = {}) {
  const existe = fs.existsSync(arquivo);
  const texto = existe ? fs.readFileSync(arquivo, "utf8") : "";
  const estado = lerPreenchidas(texto);
  const faltam = nomes.filter((n) => !estado.has(n));
  if (criar && (faltam.length || !existe)) {
    const sep = texto && !texto.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(arquivo, sep + faltam.map((n) => `${n}=\n`).join(""));
  }
  return nomes.map((n) => ({
    nome: n,
    status: estado.get(n) ? "preenchida" : "vazia",
    criada: criar && faltam.includes(n),
  }));
}

function principal(argv) {
  const nomes = [];
  let criar = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--criar") criar = true;
    else if (a === "--rede") {
      const rede = argv[++i];
      if (!REDES[rede]) {
        console.error(`Rede desconhecida. Use: ${Object.keys(REDES).join(", ")}`);
        return 2;
      }
      nomes.push(...REDES[rede]);
    } else if (NOME_VALIDO.test(a)) nomes.push(a);
    else {
      console.error(`Nao entendi "${a}". Passe NOMES_EM_MAIUSCULAS ou --rede <nome>.`);
      return 2;
    }
  }
  if (!nomes.length) {
    console.error("Informe nomes de variaveis ou --rede <nome>.");
    return 2;
  }
  const unicos = [...new Set(nomes)];
  for (const r of checar(unicos, { criar })) {
    console.log(`${r.nome}: ${r.status}${r.criada ? " (linha criada no .env.local)" : ""}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
