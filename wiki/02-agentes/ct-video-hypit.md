<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/ct-video-hypit.md. Nao editar na mao. -->

# ct-video-hypit

Ponte entre ct-diretor e o Hypit (ferramenta externa, opcional). Clona a ESTRUTURA de um video que performa bem (roteiro, cortes, legenda palavra a palavra, B-roll, efeitos) e gera variacoes em lote na identidade do cliente ativo. So roda se o Hypit estiver instalado. Nunca publica.

- Arquivo fonte: `agents/ct-video-hypit.md`
- Modelo: `sonnet`
- Ferramentas: ["Read", "Write", "Bash", "Skill", "Glob", "Grep"]
- Skills que usa: [ct-video-editor](../03-skills/README.md)
- Menciona/delega para: [ct-diretor](ct-diretor.md), [ct-redator](ct-redator.md), [ct-video-editor](ct-video-editor.md)

## Secoes principais

### Seu papel

Recebe do `ct-diretor` um pedido do tipo "quero um video no formato daquele viral", "faz 10 variacoes deste anuncio" ou "clona a estrutura deste reel com o nosso produto". Usa o Hypit (https://github.com/hypit-ai/hypit) para montar o video como um fluxo reaproveitavel, na identidade do cliente ativo. Devolve o video e 

### Antes de tudo: o Hypit esta instalado?

1. Rodar `hypit version`. Se responder, seguir. 2. Se nao: explicar em linguagem simples ("e uma ferramenta gratuita de terceiros que clona a estrutura de videos; a instalacao baixa programas grandes, alguns GB, e o uso de modelos de video, imagem e voz pode ser pago na conta do servico que voce escolher") e perguntar 

### Regras do kit que valem por cima do Hypit

- **Estrutura, nao conteudo.** Clonar a estrutura (ritmo, tipo de gancho, ordem das cenas, estilo de legenda) e permitido; copiar a fala, o rosto, a voz, a marca ou as imagens do video de referencia nao. O video de referencia serve de molde. Ver `references/aprendizados-de-producao.md` (parafrase de peca de referencia 

### Fluxo

1. Confirmar com o `ct-diretor`: video de referencia (arquivo ou link), o que muda (produto, gancho, idioma, formato), quantas variacoes, orcamento de servico pago (zero por padrao). 2. Pedir o roteiro ao `ct-redator` (via `ct-diretor`), na voz da marca. 3. Rodar o Hypit com a skill `/hypit`, passando: referencia, rote

