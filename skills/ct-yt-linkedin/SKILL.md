---
name: ct-yt-linkedin
description: "Transforma video YouTube em post LinkedIn otimizado com link do video"
metadata:
  kit:
    emoji: "💼"
---
# YouTube to LinkedIn - Post LinkedIn a partir de Video YouTube

Recebe o link do YouTube e reaproveita a descricao do video (ja salva em content/{slug}/youtube/)
pra criar um post LinkedIn otimizado, com o link do video como CARTAO de previa (regra unica de link externo no LinkedIn, abaixo).

Antes de escrever, ler `clients/{slug}/brand-profile.md` (voz e secao "Preferencias de formato"), `clients/{slug}/voice-patterns.md` (secao "Legendas aprovadas") e `clients/{slug}/regras-cliente.md`. A marca vence esta skill.

## Fluxo

```
Usuario manda link do YouTube (ex: https://youtu.be/ID_DO_VIDEO)
        ↓
Skill identifica o episodio em content/{slug}/youtube/
        ↓
Le descricao.txt e titulo.txt do episodio
        ↓
ct-otimizador adapta pro formato LinkedIn
        ↓
Salva post-linkedin.txt na pasta do episodio
        ↓
Publica com o link do video como cartao de previa (publish-linkedin-link.mjs)
```

## Input

O usuario envia:
1. Link do YouTube (ex: `https://youtu.be/ID_DO_VIDEO`)
2. Opcional: contexto extra ou angulo especifico pro LinkedIn

## Regras do Post LinkedIn (CRITICAS)

### Formato
- Post de TEXTO PURO e independente (funciona sozinho sem video)
- Limite duro de 3.000 caracteres `[MECANICA]`; o tamanho certo e o que o assunto pede (faixas de 1.200 a 2.000 sao `[HIPOTESE]` de fonte externa, nao meta)
- Paragrafos curtos de 1-2 linhas (mobile-first)
- Espacamento generoso entre paragrafos

### Estrutura
1. **HOOK** (2 primeiras linhas), TUDO depende disso
   - Forte nos primeiros 140 chars (antes do "ver mais"), igual ao `ct-redator`
   - Abrir no fato concreto do video ou em um dado real, nao em frase de efeito
   - Abertura no estilo direto da marca (`voice-patterns.md`), sem cliche
2. **HISTORIA/INSIGHT** (corpo)
   - Storytelling na pessoa gramatical da marca (`brand-profile.md`)
   - Dados concretos quando possivel
   - Extrair os insights PRINCIPAIS do video (nao resumir tudo)
   - Escolher 1-2 pontos fortes, nao listar todos os topicos
3. **VALOR**, Dica pratica ou aprendizado que funciona sozinho
4. **Fechamento**, pergunta ESPECIFICA so quando nascer natural do texto (senao, afirmacao firme)
   - ✅ "Qual dessas praticas voce testaria primeiro?"
   - ✅ "Quantas horas por semana sua equipe gasta com isso hoje?"
   - ❌ NUNCA "Comenta QUERO que mando" (engagement bait, LinkedIn penaliza)
   - Sem hashtag por padrao (se a marca usa, maximo 5)

### Link externo (REGRA UNICA, igual em todos os agentes)
- Link externo no LinkedIn vai no PRIMEIRO COMENTARIO, nao no corpo (link no corpo tende a reduzir alcance, `[HIPOTESE]`). Excecao por marca: so se registrada em `regras-cliente.md`.
- EXCECAO do YouTube: o video vai como CARTAO de previa (thumbnail), publicado por `node scripts/publishing/publish-linkedin-link.mjs --text-file <post-linkedin.txt> --url <youtube> --title "<titulo>"` (`--dry-run` para conferir). O link do YouTube nao vai escrito no corpo nesse caso.
- Fallback manual (API fora do ar): colar `https://youtu.be/<id>` na ULTIMA linha do corpo para o LinkedIn gerar a previa, e conferir que o cartao apareceu antes de publicar.
- Link do material (repositorio, pagina) vai no primeiro comentario.

### Emojis
- 1-3 emojis estrategicos como marcadores
- NUNCA 10+ (forcado)
- Usar como bullets: →, ✓, pontos

### Tom de Voz
- Autenticidade > formalidade
- Conversacional mas inteligente
- Opiniao forte sobre temas do setor
- Confiante, pratico, sem jargao tecnico desnecessario
- O registro exato (formal ou conversacional) vem do `brand-profile.md`
- Texto para o seguidor: sem linguagem de processo da producao

## Output

Entregar EXATAMENTE neste formato:

```
## POST LINKEDIN

[texto do post completo]

---

## INSTRUCAO DE PUBLICACAO

1. Publicacao: API com `publish-linkedin-link.mjs` (cartao de previa) se a marca tem app LinkedIn; senao, cole o texto (com o link youtu.be na ultima linha) no LinkedIn e publique na mao
2. Confirme que a PREVIA do video (card com thumbnail) apareceu antes de publicar
3. Publique o post so com o "pode" do usuario
4. Horario: vem do ct-social-intel/cockpit; sem dado, pergunte ao usuario

---
```

Salvar como `post-linkedin.txt` na pasta do episodio em content/{slug}/youtube/.

## Exemplo de Adaptacao

**Descricao YouTube (input):**
"Aprenda a organizar o fluxo de atendimento da sua empresa gastando menos tempo por semana..."

**Post LinkedIn (output):**
```
A maioria das empresas ainda gasta horas toda semana com tarefas repetitivas.

Um fluxo simples resolve isso em quatro passos:

→ Mapear a tarefa que mais se repete
→ Definir quem decide e quem executa
→ Automatizar so o que ja funciona na mao
→ Medir o tempo economizado

Gravei uma aula mostrando cada passo, com um caso real.

Quantas horas por semana sua equipe gasta com isso hoje?

(o link do video vai como cartao de previa, nao escrito aqui)
```

## Agentes que Usam

- **ct-otimizador** - Adapta conteudo pro formato LinkedIn
- **ct-redator** - Escreve o texto do post
- **ct-reciclador** - Transforma conteudo YouTube em outros formatos
