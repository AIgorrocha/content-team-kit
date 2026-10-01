#!/usr/bin/env bash
# social-intel-weekly.sh - Versao SEM navegador do pipeline semanal (Mac, Linux, servidor).
# Roda so o que funciona sem login de navegador: Instagram, LinkedIn (API), YouTube, melhor
# horario, concorrentes, tendencias e cockpit, para a marca ativa (.workspace ou CT_CLIENT).
# TikTok e posts salvos precisam de navegador logado: use social-intel-local.mjs no seu computador.
#
# Agendar com cron (domingo 08h), trocando <pasta-do-kit> pelo caminho do projeto:
#   0 8 * * 0 bash <pasta-do-kit>/scripts/infra/social-intel-weekly.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO" || exit 1
set -a
[ -f .env ] && source .env
[ -f .env.local ] && source .env.local
set +a

CLIENT="${CT_CLIENT:-}"
if [ -z "$CLIENT" ] && [ -f .workspace ]; then
  CLIENT="$(sed -n 's/^[[:space:]]*client:[[:space:]]*\([a-z0-9-]*\).*/\1/p' .workspace | head -1)"
fi
if [ -z "$CLIENT" ]; then
  echo "Marca ativa nao encontrada. Crie o arquivo .workspace com 'client: {slug}'." >&2
  exit 1
fi

LOG="${SOCIAL_INTEL_LOG:-$REPO/social-intel-weekly.log}"
echo "===== $(date -Is) social-intel-weekly START ($CLIENT) =====" >> "$LOG"

# Cada passo e protegido: falha de um nao derruba o resto.
run() { echo "--- $* ---" >> "$LOG"; node "$@" >> "$LOG" 2>&1; }

# 1. Analyzers
run skills/ct-instagram-analyzer/analyze.js --account all --limit 30
if [ -n "${LINKEDIN_ACCESS_TOKEN:-}" ]; then
  run skills/ct-linkedin-analyzer/analyze-personal.js --limit 25
  [ -n "${LINKEDIN_ORG_ID:-}" ] && run skills/ct-linkedin-analyzer/analyze-company.js --limit 25
fi
[ -n "${YOUTUBE_REFRESH_TOKEN:-}" ] && run skills/ct-youtube-analyzer/analyze.js --limit 25

# 2. Melhor horario
run skills/ct-social-intel/compute.js --client "$CLIENT" --platform all --days 90

# 3. Concorrentes (Instagram via RapidAPI), so se RAPIDAPI_KEY existir
if [ -n "${RAPIDAPI_KEY:-}" ]; then
  run skills/ct-social-cockpit/competitor-snapshot.js --client "$CLIENT" --limit 5
else
  echo "--- RAPIDAPI_KEY ausente, pulando concorrentes ---" >> "$LOG"
fi

# 4. Tendencias e cockpit
run skills/ct-social-cockpit/trends-snapshot.js --days 30
run skills/ct-social-cockpit/build.js --client "$CLIENT"

# 5. Resumo no Telegram (opcional: precisa de TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID)
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  F="$REPO/content/$CLIENT/cockpit.md"
  SUMMARY=""
  [ -f "$F" ] && SUMMARY="$(grep -E '^## |Posts \(30d\)|Melhor horario|Formato campeao' "$F" | head -20 | sed 's/^## /  - rede: /')"
  MSG="Social Intel semanal ($(date +%d/%m)), marca $CLIENT"$'\n\n'"${SUMMARY}"$'\n\n'"Painel completo: content/$CLIENT/cockpit.md"
  RESP="$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode chat_id="${TELEGRAM_CHAT_ID}" --data-urlencode text="$MSG")"
  echo "Telegram: ok=$(echo "$RESP" | grep -c '"ok":true')" >> "$LOG"
else
  echo "Telegram nao configurado, pulando aviso." >> "$LOG"
fi

echo "===== $(date -Is) social-intel-weekly END =====" >> "$LOG"
