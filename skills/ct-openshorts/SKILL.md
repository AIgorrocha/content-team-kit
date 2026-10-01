---
name: ct-openshorts
description: "Liga e desliga o OpenShorts (gerador de clipes/shorts com IA, self-hosted em Docker) SO enquanto o usuario esta editando video. Sobe o compose, abre a UI, registra o MCP dele pra sessao, e derruba no fim pra nao gastar RAM. EXCLUSIVO terminal local (Docker do PC). Triggers: 'abre o openshorts', 'sobe o openshorts', 'gerar clipes desse video', 'cortar shorts', 'fecha o openshorts'."
environment: local
---

# ct-openshorts, OpenShorts sob demanda

OpenShorts (pasta `../openshorts`, ao lado do kit; projeto `mutonby/openshorts`, nucleo MIT; a pasta
`cloud/` dele tem licenca comercial propria, nao usar nem revender) corta video longo
em clipes verticais com legenda, gera UGC com atores IA e tem estudio YouTube. Roda em Docker
(backend 12 GB de imagem, renderer, frontend). **Nunca fica ligado em background**;
sobe so quando o usuario edita e desce no fim. Auto-start desligado (`restart=no`).

## Quando usar
- O usuario quer cortar um video longo em shorts/reels, gerar clipes com legenda, ou usar o estudio.
- NAO usar pra: reel talking-head do cliente (ct-video-editor), motion (ct-video-remotion), faceless (ct-video-mpt).

## Instalacao (uma vez)

Precisa de Docker Desktop. A pasta `../openshorts` NAO vem no kit: clone-a ao lado dele.

```bash
cd ..                                              # pasta que contem o kit
git clone https://github.com/mutonby/openshorts.git
cd openshorts
cp .env.example .env                               # backup em S3 e opcional
docker compose build                               # baixa imagens grandes (backend ~12 GB), so na 1a vez
```
Na UI (Settings), cadastrar as chaves que for usar: Google Gemini (obrigatoria), fal.ai (shorts com
IA), ElevenLabs (voz e dublagem). **Nao cadastrar a chave do Upload-Post**: publicar e sempre pelas
skills `ct-publicar-*` depois do "pode". As chaves ficam no cofre de senhas; nunca commitar.

## Comandos (PowerShell ou Bash)

```bash
cd ../openshorts
docker compose up -d            # sobe backend, renderer, frontend
docker compose ps               # backend deve ficar healthy (ate 1 min)
# UI:   http://localhost:5175
# API:  http://localhost:8000   (docs em http://localhost:8000/docs)
# (as portas podem variar conforme a versao: confirme no docker-compose.yml do OpenShorts)
docker compose down             # FIM DA SESSAO: derruba tudo, libera RAM. Volumes/dados ficam.
```

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui.

## Fluxo
1. `docker compose up -d`, esperar `healthy`.
2. Entregar a URL da UI pro usuario (ele opera o corte). Se a versao instalada expuser MCP ou API, usar so nesta
   sessao (nao gravar em config global) e nunca a acao de publicar (`publish_clip`).
3. Saida de video vai pra `content/{slug}/reels/{nome}/` (regra de pastas do content-team). Nunca em `output/`.
4. Legenda/post: ct-redator. Publicacao: sempre manual, aprovacao do usuario antes.
5. **Sempre fechar com `docker compose down`** e confirmar com `docker ps` que nada do openshorts ficou de pe.

## Regras
- Nunca deixar o OpenShorts rodando fora de uma sessao de edicao (consome muita RAM).
- Nunca `docker compose down -v` (apaga volumes). Nunca `docker system prune` a partir daqui.
- Segredos so em `.env` local e no seu cofre de senhas; nunca no repo content-team.
