# Integracoes

Cada integracao abaixo habilita uma funcao do framework. A coluna "Nota" diz se
e obrigatoria ou opcional e pra que serve. Preencher a variavel correspondente
em `.env.local` (nunca commitar esse arquivo).

<!-- WIKI:GERADO:START -->
### Variaveis por integracao (gerado)

| Integracao | Nota | Variaveis de ambiente |
|---|---|---|
| Banco Supabase | OBRIGATORIO para o painel e o historico; a instalacao local preenche sozinha | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `POSTGRES_URL`, `DATABASE_SSL`, `SALA_LOCAL_DATABASE_URL` |
| Login e seguranca do painel | OBRIGATORIO para abrir o painel | `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` |
| Instagram | so se for publicar ou analisar no Instagram | `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_APP_SECRET`, `IG_APP_ID`, `IG_OAUTH_CLIENT_ID`, `IG_OAUTH_CLIENT_SECRET`, `IG_HANDLE`, `INSTAGRAM_BUSINESS_USER_ID`, `INSTAGRAM_BUSINESS_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_HANDLE`, `FB_APP_ID`, `FB_APP_SECRET` |
| Threads | OPCIONAL | `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`, `THREADS_HANDLE` |
| Resposta automatica a comentarios e DM do Instagram/YouTube | OPCIONAL, servidor proprio | `IG_VERIFY_TOKEN`, `PUBLIC_BASE`, `PORT`, `HOST`, `MAX_BODY_BYTES`, `MAX_PER_USER_HOUR`, `MAX_PER_MINUTE`, `RELOAD_TOKEN`, `OAUTH_SCOPE`, `RULES_FILE`, `TOKEN_FILE`, `SEEN_FILE`, `PENDING_FILE`, `LOG_FILE`, `DELETIONS_FILE`, `YT_VIDEO_IDS`, `YT_SEEN_FILE`, `YT_LOG_FILE`, `IG_KEYWORD`, `IG_REEL_URL`, `IG_FOLLOWER_URL` |
| Meta Ads | OPCIONAL: so para quem roda anuncios | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| LinkedIn | so se for publicar ou analisar no LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `LINKEDIN_ORG_ID`, `LINKEDIN_SCOPES`, `LINKEDIN_HANDLE`, `LINKEDIN_COMPANY_HANDLE`, `LINKEDIN_SEARCH_KEYWORDS` |
| YouTube | OPCIONAL | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` |
| TikTok | OPCIONAL: a publicacao hoje e pelo navegador logado | `TIKTOK_HANDLE`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN` |
| X / Twitter | OPCIONAL: publica pelo navegador logado | `X_HANDLE`, `X_KEYWORDS`, `X_QUEUE_MIRROR_DIR` |
| Telegram | OPCIONAL: aprovacao de pecas e avisos pelo celular | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DIGEST_TELEGRAM` |
| IA | OPCIONAL: transcricao, painel e editor de video automatico | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `CONTENT_TEAM_MODEL`, `SALA_ENTREVISTA_MODEL` |
| Video: ferramentas locais | OPCIONAL | `FFMPEG_BIN`, `FFPROBE_BIN`, `SELF_EVAL`, `BROWSER_EXECUTABLE`, `WHISPER`, `CT_MOTION_PLAYWRIGHT_PATH` |
| HeyGen | OPCIONAL: avatar digital, servico pago | `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID` |
| Higgsfield | OPCIONAL: video cinematografico, consome creditos | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_SECRET`, `HIGGSFIELD_ENABLED`, `HIGGSFIELD_BIN`, `HIGGSFIELD_IMG_MODEL`, `HIGGSFIELD_VID_MODEL`, `HIGGSFIELD_WAIT_TIMEOUT` |
| Remotion na nuvem / AWS | OPCIONAL: o render local ja e gratis sem isso | `REMOTION_AWS_REGION`, `REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`, `REMOTION_SERVE_URL`, `REMOTION_AWS_BUCKET`, `REMOTION_FUNCTION_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Cloudflare R2 | OPCIONAL: guarda criativos em lote | `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |
| Pesquisa de concorrentes | OPCIONAL | `RAPIDAPI_KEY`, `CT_COMPETITORS_IG`, `SEARXNG_URL` |
| Outros opcionais |  | `NOTION_TOKEN`, `FIGMA_ACCESS_TOKEN`, `AI_MEMORY_URL`, `AI_MEMORY_AUTH_TOKEN` |
| Ajustes do app | OPCIONAL: cada um so quando voce usa o recurso | `CRON_SECRET`, `ADMIN_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEFAULT_CLIENT_SLUG`, `CT_CLIENT`, `CT_ICLOUD_INBOX`, `CT_ICLOUD_BOXES`, `CT_COCKPIT_HOST`, `CT_IG_DAILY`, `SOCIAL_INTEL_LOG`, `NO_PUBLISH`, `KIT_UPSTREAM_URL` |
| Painel: eventos ao vivo do terminal |  | `SALA_HOOK_TOKEN`, `SALA_URL`, `SALA_OAUTH_ORIGIN`, `SALA_DATA`, `SALA_LIVE`, `SALA_WATCH_POLL`, `SALA_LEGACY_TOKEN_CLIENT`, `SALA_REGRAS_CLIENT`, `SALA_REGRAS_FILE`, `SALA_MEMORY_CLIENT`, `SALA_MEMORY_PROJECT` |

Fonte: `.env.local.example` (21 integracoes mapeadas). Nenhum valor real e copiado aqui, so nome de variavel.

<!-- WIKI:GERADO:END -->
