# Fluxo padrão: do vídeo longo do YouTube pras redes

Documento canônico do caminho "1 vídeo longo vira N peças". Vale pra qualquer cliente,
cada um usando só as redes que tem (ver `clients/{slug}/brand-profile.md`).

Quem lê: `ct-diretor` (antes de delegar), `ct-reciclador`, `ct-redator`, `ct-video-editor`,
`ct-otimizador`, `ct-social`. Precedência: `clients/{slug}/brand-profile.md` > este doc >
`references/viral-playbook.md`.

## A ordem (não inverter)

```
1. YouTube longo (horizontal)          <- peça-mãe. Título/descrição/tags via claude-seo
        Upload: scripts/publishing/upload-youtube-api.mjs <video> <titulo.txt> <descricao.txt> [tags.txt] --long --pode
        |
2. Cortes 9:16 (ct-video-editor ou ct-openshorts) -> Reel no Instagram (normal + trial)
        |
3. Mesmo MP4 -> TikTok
        |
4. Mesmo MP4 -> YouTube Shorts (ligado ao longo)
        |
5. LinkedIn por último: texto READAPTADO pelo ct-redator + publicado por API com o YouTube
   longo como cartão de prévia (`scripts/publishing/publish-linkedin-link.mjs`)
```

Regras de ordem que já existem e continuam: Instagram fecha PRIMEIRO com aprovação de quem publica
(regra 4.9), LinkedIn é adaptação no FIM (nunca em paralelo), cross-post no mesmo dia (3.3),
todo reel sai também como trial (3.3b).

## Cada rede é avaliada sozinha: CTA depende de ter automação

A pergunta por rede é uma só: **existe resposta automática de comentário nessa rede?**

| Rede | Automação de comentário | CTA permitido | Onde vai o link |
|---|---|---|---|
| Instagram (Reel, carrossel, foto) | SIM: `ig-webhook` (resposta pública + DM, follow gate) | "Comenta PALAVRA que te mando no direct" | Só na DM. Nada de link na legenda |
| YouTube Shorts e vídeo longo | SIM: `yt-comment-responder` (resposta pública na thread, sem DM) | "Comenta PALAVRA que eu respondo com o link" | Na resposta pública E na descrição (link do longo + repositório) |
| TikTok | NÃO | "Link na bio" ou "comentário fixado" | Bio + comentário fixado por quem publica. Nunca "comenta PALAVRA" |
| LinkedIn | NÃO | Pergunta aberta no fim. Nunca "comenta PALAVRA", zero hashtag | YouTube longo como cartão de prévia (`content.article`), link do material (GitHub) no corpo |

Condição dura pra escrever "comenta PALAVRA": a PALAVRA existe no
arquivo de regras do `ig-webhook` (`rules.json`, caminho em `RULES_FILE`) e está recarregada no `ig-webhook` ANTES de publicar
(`curl http://127.0.0.1:3010/ig-webhook/reload`, com o servidor do webhook rodando). Vídeo/Short novo no
YouTube: adicionar o ID em `YT_VIDEO_IDS` (ou passar como argumento do `yt-comment-responder`), senão o
responder não olha aquele vídeo.

O que a regra entrega quando alguém comenta: link do vídeo longo + link do material (repositório,
guia) + pedido de follow quando `followGate: true`. Uma regra serve todas as peças da mesma pauta
(reel, carrossel, Short), não criar uma por peça.

## Ligar o Short ao vídeo longo

Duas amarras, as duas sempre:
1. Link do longo na descrição do Short (`youtube-shorts.txt`).
2. Campo "Vídeo relacionado" no YouTube Studio apontando pro longo. É manual de quem publica; o agente
   deixa a nota no fim do `youtube-shorts.txt`, abaixo do `-----`.

## Arquivos por peça derivada (`content/{slug}/reels/{pauta}/`)

| Arquivo | Regra |
|---|---|
| `legenda-instagram.txt` | O texto ditado por quem publica é a fonte; passe de SEO com claude-seo; CTA "comenta PALAVRA"; 5 hashtags sem acento; sem link |
| `legenda-tiktok.txt` | MESMO texto do IG, trocando SÓ a frase de CTA por "link na bio / comentário fixado". Hashtags iguais |
| `youtube-shorts.txt` | TÍTULO (`#shorts` no fim) / DESCRIÇÃO (corpo do IG + link do longo + link do material + CTA "comenta PALAVRA") / TAGS. Sem capa (1.4b). Nota do "Vídeo relacionado" abaixo do `-----` |
| `post-linkedin.txt` | READAPTAÇÃO real pelo ct-redator (nunca a legenda do reel com CTA trocado). Voz do cliente, link do material (GitHub) no corpo, YouTube NÃO vai no corpo (vai como cartão de prévia com a miniatura anexada automaticamente), pergunta aberta no fim, ZERO hashtag. Publicar: `node scripts/publishing/publish-linkedin-link.mjs --text-file <txt> --url <youtube> --title "<título do vídeo>"`. CTA final pode ser ajustado à mão direto no LinkedIn: nesse caso, ressincronizar o `.txt` local com o texto que ficou no ar, não deixar a fonte local divergir do publicado |
| `capa.png` + `capa.jpg` | Foto profissional, texto no miolo, nunca no rosto (1.4b). JPEG pro `cover_url` |

## O que muda por cliente

Quais redes o cliente usa esta sempre em `clients/{slug}/brand-profile.md`. Cliente com só
Instagram e LinkedIn nao tem passo 1, 3 nem 4: a peca-mae passa a ser o reel ou carrossel de
projeto, e a tabela de CTA vale igual (Instagram pode ter "comenta PALAVRA", conferir a regra
por conta na `rules.json` antes; LinkedIn nunca).

## Checklist do ct-diretor (colar na delegação)

```
[ ] Vídeo longo no ar? Título/descrição/tags passaram pelo claude-seo (sem número de volume inventado)
[ ] Regra da PALAVRA em rules.json + reload do ig-webhook + ID do vídeo em YT_VIDEO_IDS
[ ] Cortes 9:16 aprovados por quem publica (visual E áudio: assistir do início ao fim com som, `references/aprendizados-de-producao.md` item 5.3)
[ ] Legenda IG aprovada -> só então TikTok/Shorts/LinkedIn adaptados
[ ] Capa 9:16 conferida (rosto livre) -> publicar IG normal + trial (MANUAL)
[ ] TikTok: mesma legenda com CTA trocado; quem publica fixa comentário com o link
[ ] Shorts: descrição com link do longo; nota "Vídeo relacionado" pra quem publica
[ ] LinkedIn: texto readaptado aprovado -> publish-linkedin-link.mjs com o YouTube como prévia
[ ] registerPublication() com o permalink de cada rede (regra do join)
[ ] Cópia final na pasta de entrega da marca (Drive, se a marca usa)
```
