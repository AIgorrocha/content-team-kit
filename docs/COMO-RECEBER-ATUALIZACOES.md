# Como receber atualizações do kit e avisar de problemas

O kit é melhorado com frequência. Este guia mostra como baixar, como receber as melhorias sem
perder a sua marca e como avisar quando algo der errado. Tudo pode ser feito conversando com o
Claude Code ou o Codex dentro da pasta do kit.

Sua marca (textos, cores, peças) fica nas pastas `clients/` e `content/`. As atualizações
nunca apagam nem trocam essas pastas.

## a) Primeira vez: baixar o kit

**Jeito fácil:** crie uma pasta vazia (por exemplo `Documentos/kit-conteudo`), abra o Claude
Code (ou o Codex) dentro dela e diga:

> baixar o kit

Ele baixa o kit para dentro dessa pasta e depois é só dizer "configurar empresa nova". Por baixo, o comando é
`git clone https://github.com/AIgorrocha/content-team-kit.git` (clonar = baixar uma cópia
que depois sabe receber as novidades).

**Jeito com botões:**

1. Instale o **Git** (programa que guarda versões dos arquivos): https://git-scm.com/downloads
2. Instale o **GitHub Desktop** (programa com botões para usar o Git): https://desktop.github.com
3. No GitHub Desktop: menu **File, Clone repository, aba URL**, cole
   `https://github.com/AIgorrocha/content-team-kit.git` e clique em **Clone**.

## b) Recomendado: guardar a sua marca num lugar privado seu

Sem este passo o kit funciona, mas a sua marca fica só neste computador. Se o computador
quebrar, você perde tudo. Com este passo, você tem uma cópia de segurança **privada** (só você
vê; nem quem mantém o kit, nem outras empresas).

Precisa de uma conta GitHub gratuita (https://github.com).

**Jeito fácil:** diga ao Claude:

> criar meu repositório privado

Ele confere se o GitHub está conectado no seu computador (se não estiver, abre a tela de login
para você entrar), cria um repositório **privado** na sua conta e liga a pasta a ele. O kit
oficial continua ligado só para trazer novidades. Por baixo, os comandos são
`git remote rename origin upstream` e
`gh repo create meu-kit-conteudo --private --source . --remote origin --push`.

**Jeito com botões:**

1. No site do GitHub, clique em **New repository** (novo repositório), dê um nome (por exemplo
   `meu-kit-conteudo`), **marque "Private"** (privado: só você vê) e clique em **Create**.
   Não marque nenhuma outra opção. Copie o endereço que aparece (termina em `.git`).
2. No GitHub Desktop, com o kit aberto: menu **Repository, Repository settings, Remote**, troque
   o endereço pelo que você copiou e salve. Depois clique em **Push origin** (enviar).
3. Pronto: a sua cópia privada passa a ser o "origin" (endereço principal). Na próxima vez que
   você pedir "atualizar o kit", o assistente liga o kit oficial como "upstream" (endereço de
   onde vêm as novidades) sozinho.

Para guardar as novidades da sua marca depois de trabalhar: no GitHub Desktop, escreva um
resumo no campo **Summary**, clique em **Commit to master** (salvar uma versão) e depois em
**Push origin** (enviar para a cópia privada). Se preferir, peça ao Claude: "salvar a minha
marca no meu repositório privado".

## c) Receber atualizações

Diga ao Claude:

> atualizar o kit

Ele mostra o que vai mudar em palavras simples, pergunta se pode e só então aplica. Se as
novidades trouxerem peças novas, ele avisa e pede permissão para instalá-las. Se der
problema, ele desfaz tudo e a sua marca continua intacta.

Dica: não edite os arquivos das pastas `agents/` e `skills/` (são do kit). Para ensinar uma
preferência da sua marca, peça ao Claude: ele guarda em `clients/` e isso nunca dá conflito.

## d) Avisar de um problema ou sugerir melhoria

Diga ao Claude:

> reportar problema

Ele pergunta o que aconteceu, monta um relatório e **mostra o texto completo antes de enviar**.
Só envia se você disser "pode". O relatório nunca leva senhas, chaves nem o conteúdo da sua
marca. Se você não tiver conta no GitHub, ele entrega o texto pronto para você mandar por
WhatsApp ou e-mail para quem te passou o kit.

Também serve para **sugestão**: "sugerir melhoria" (por exemplo, uma correção que deveria
valer para todas as empresas).

Prefere pelo site? Abra https://github.com/AIgorrocha/content-team-kit/issues/new/choose,
escolha **Problema** ou **Sugestão** e preencha o formulário (não cole senhas, chaves nem
dados dos seus clientes).
