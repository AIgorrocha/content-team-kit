# Skills e ferramentas externas recomendadas

O kit já traz o essencial. Estas ferramentas de terceiros acrescentam capacidades, mas ficam
**fora** do kit (licença, tamanho ou porque baixam regras da internet a cada uso). Instale só
o que for usar. O assistente pode instalar para você: peça, por exemplo, "instalar a skill
image-to-code".

| Ferramenta | Para que serve | Como instalar | Observação |
|---|---|---|---|
| image-to-code (taste-skill) | Landing page de alto impacto: gera a imagem de referência primeiro e depois o código | `npx skills add leonxlnx/taste-skill` | MIT. Precisa de um gerador de imagem já configurado |
| web-interface-guidelines (Vercel) | Revisão de página web e acessibilidade, com apontamento por arquivo e linha | `npx skills add vercel-labs/web-interface-guidelines` | MIT. Baixa as regras da internet a cada uso |
| awesome-design-md (VoltAgent) | Coleção de análises de estilo visual de marcas conhecidas, para inspiração | `git clone https://github.com/VoltAgent/awesome-design-md` | MIT no texto. Use só o estilo; nome e logo da marca analisada nunca entram na peça |
| Hypit | Clonar a **estrutura** de um vídeo viral (roteiro, cortes, legenda, B-roll) e gerar variações em lote | `npx skills add hypit-ai/hypit -g` | Licença própria (Apache-2.0 com condições): uso interno e para clientes é permitido; revender o Hypit não. Baixa programas grandes na instalação. Usado pelo agente `ct-video-hypit` |

Já incluída no kit: `design-taste-frontend` (taste-skill, MIT), em
`skills/design-taste-frontend/`, para landing pages e páginas sem cara de modelo pronto.

## Antes de instalar qualquer ferramenta nova

Diga "avaliar essa ferramenta" e cole o link: a skill `ct-avaliar-novidade` faz a conferência
abaixo por você e entrega um parecer antes de instalar. Resumo do que ela confere:


1. Ver a licença (o arquivo LICENSE do repositório). Sem licença, não copiar para o kit.
2. Ler o que a skill manda o agente fazer: scripts de instalação, programas baixados, chaves
   pedidas, envio de dados para fora.
3. Instalar primeiro numa pasta de teste.
4. Nunca colar chave no chat: a chave vai para o `.env.local`.

Para sugerir uma ferramenta para todos, diga "sugerir melhoria" (skill `ct-reportar-problema`).

## Usadas pelo vídeo por código

| Ferramenta | Para que serve | Como instalar |
|---|---|---|
| remotion-best-practices (Remotion) | Regras oficiais para animar com o Remotion; os agentes de vídeo por código seguem esta skill | `npx skills add remotion-dev/skills` |
| Prompt Motion (prompt-motion.com) | Galeria de motion graphics feitos com Claude, cada vídeo com o prompt ou a skill de origem (UI, gráfico, diagrama, tipografia cinética, partículas, personagens). Referência de ideia para o motion em código: ver, reescrever a técnica com palavras próprias, nunca copiar prompt ou skill (o site não tem licença; cada entrada pertence ao criador linkado) | Nada a instalar; só consultar o site |
