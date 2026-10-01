#!/usr/bin/env node
// Checa as conexoes de rede do cliente ativo e grava status/last_checked_at em ct_connections.
// Nunca fabrica obtained_at/expires_at aqui; so quem autoriza (fluxo OAuth) grava essas datas.
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { resolveClient } from "../_lib/workspace-client.mjs"
import { checarConexao, registrarConexao, buscarConexao, encerrarPool } from "./connections-lib.mjs"

const REDES = ["linkedin", "meta_ads", "instagram", "youtube", "tiktok"]
let poolCofre

async function main() {
  const { lerCredencialOAuth } = await import("../../src/lib/sala/oauth-credentials.ts")
  poolCofre = (await import("../../src/lib/db.ts")).default
  const clientSlug = resolveClient()
  const agora = new Date().toISOString()
  const linhas = []
  for (const servico of REDES) {
    const existente = await buscarConexao(clientSlug, servico)
    const expiresAt = existente?.expires_at || null
    const env = { ...process.env }
    if (env.SALA_LEGACY_TOKEN_CLIENT !== clientSlug) {
      for (const chave of ["LINKEDIN_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN", "META_ACCESS_TOKEN", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_ACCESS_TOKEN", "TIKTOK_SESSION_DIR"]) delete env[chave]
    }
    let falhaCofre = false
    if (existente?.credential_ref && servico !== "tiktok") {
      try {
        const cred = await lerCredencialOAuth(clientSlug, servico)
        if (!cred) throw new Error("referencia invalida")
        if (servico === "linkedin") env.LINKEDIN_ACCESS_TOKEN = cred.accessToken
        if (servico === "instagram") env.INSTAGRAM_ACCESS_TOKEN = cred.accessToken
        if (servico === "meta_ads") env.META_ACCESS_TOKEN = cred.accessToken
        if (servico === "youtube") {
          env.YOUTUBE_REFRESH_TOKEN = cred.refreshToken ?? ""
          env.YOUTUBE_ACCESS_TOKEN = cred.accessToken
        }
      } catch { falhaCofre = true }
    }
    const resultado = falhaCofre ? { status: "unknown", motivo: "credencial salva indisponivel" } : await checarConexao(servico, {
      env,
      expiresAt,
      sessionDir: env.TIKTOK_SESSION_DIR,
    })
    await registrarConexao({
      client_slug: clientSlug,
      service: servico,
      status: resultado.status,
      last_checked_at: agora,
      ...(resultado.expires_at ? { expires_at: resultado.expires_at } : {}),
    })
    linhas.push({
      servico,
      status: resultado.status,
      dias_restantes: resultado.expiraEmDias ?? "",
      motivo: resultado.motivo || "",
    })
  }
  console.table(linhas)
}

main()
  .catch((erro) => {
    console.error("Falha ao checar conexoes. Confira o banco e a configuracao local.")
    process.exitCode = 1
  })
  .finally(async () => {
    await encerrarPool()
    await poolCofre?.end()
  })
