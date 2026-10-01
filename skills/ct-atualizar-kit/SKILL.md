---
name: ct-atualizar-kit
description: "Traz a versão nova do kit (correções e melhorias de quem mantém o kit) sem mexer na marca da pessoa. Mostra em linguagem simples o que vai mudar, pede 'pode' e aplica. Trigger: 'atualizar o kit', 'tem atualização?', 'pegar a versão nova', 'o kit tá desatualizado'."
environment: local
metadata: { "kit": { "emoji": "🔄" } }
---

# ct-atualizar-kit: pegar a versão nova do kit

Dono: `ct-diretor`. A pessoa é leiga: nada de jargão. A marca dela (`clients/` e `content/`)
nunca é tocada nem apagada por esta skill.

## Regras

1. **Sempre verificar antes de aplicar.** Nunca rodar o comando sem `--verificar` primeiro.
2. **Só aplicar depois do "pode"** da pessoa.
3. **Nunca apagar nada** de `clients/` ou `content/`, nem "limpar" a pasta pra destravar.
4. **Nunca rodar `npm install` sem permissão** explícita.
5. Nada de travessão nos textos.

## Passos

1. **Verificar:** `node scripts/kit/atualizar.mjs --verificar`.
2. **Contar em linguagem simples.**
   - "já está atualizado": dizer isso e parar.
   - Lista de novidades: resumir em 2 a 5 frases do que muda pra ela (ex.: "corrige o erro ao
     agendar post", "novo jeito de montar carrossel"), sem citar nome de arquivo nem código.
     Dizer que a marca dela não muda.
3. **Pedir o "pode":** "Posso atualizar agora?". Esperar.
4. **Aplicar:** `node scripts/kit/atualizar.mjs`.
5. **Se a saída avisar `npm install`:** explicar ("o kit ganhou peças novas que precisam ser
   instaladas, leva alguns minutos"), pedir permissão e só então rodar `npm install`.
6. **Fechar** em 1 linha: "Kit atualizado. Sua marca continua igual."

## Se o script recusar

| Mensagem | O que dizer e fazer |
|---|---|
| Pasta não baixada com o Git | Oferecer "baixar o kit" (`docs/COMO-RECEBER-ATUALIZACOES.md`, parte a) |
| Alterações não salvas em arquivo do kit | Explicar: "alguém mexeu num arquivo que é do kit". Listar os arquivos, perguntar se ela quer **desfazer** a mudança ou **salvar**. Só agir depois da resposta. Se ela editou regra de marca em arquivo do kit, mover a regra pra `clients/{slug}/regras-cliente.md` antes de desfazer |
| Atualização pela metade | Não mexer em nada. Mostrar a mensagem e pedir pra ela chamar quem passou o kit, se não resolver |
| Sem internet | Pedir pra tentar de novo quando conectar |

## Se houver conflito

O script já desfaz tudo sozinho (a pasta volta ao que era) e lista os arquivos que não couberam.

1. Explicar simples: "você e o kit mudaram o mesmo trecho destes arquivos, então não deu pra
   juntar sozinho. Desfiz tudo, nada se perdeu".
2. Oferecer ajuda: ver o que ela mudou em cada arquivo. Se a mudança dela era regra de marca,
   levar pra `clients/{slug}/regras-cliente.md` e oferecer descartar a edição no arquivo do kit.
3. Só resolver com o "pode". Nunca apagar nada de `clients/` ou `content/`.
4. Se o conflito parece erro do próprio kit, oferecer `ct-reportar-problema`.

## Guardar a marca num repositório privado próprio

Gatilhos: "criar meu repositório privado", "salvar a minha marca no meu repositório privado".
Objetivo: a marca da pessoa (`clients/`, `content/`) ganha cópia de segurança num repositório
**privado** da conta GitHub dela. O kit oficial fica só como fonte de novidades.

1. Conferir `gh auth status`. Se não estiver logado: explicar que vai abrir o navegador para ela
   entrar na conta GitHub dela e rodar `gh auth login --web` (com permissão). Se o `gh` não
   existir: oferecer instalar (`winget install GitHub.cli` no Windows, `brew install gh` no Mac)
   ou seguir o jeito com botões de `docs/COMO-RECEBER-ATUALIZACOES.md`, parte b.
2. Ver os remotos (`git remote -v`). Se o `origin` aponta para o kit oficial:
   `git remote rename origin upstream`.
3. Perguntar o nome (sugestão: `meu-kit-conteudo`) e confirmar que será **privado**.
4. Com o "pode": `gh repo create {nome} --private --source . --remote origin --push`.
5. Conferir com `gh repo view {nome} --json visibility` que está `PRIVATE`. Se não estiver,
   parar e avisar.
6. Para salvar depois: `git add clients content` + `git commit` com resumo simples + `git push`,
   sempre mostrando o que vai subir e pedindo "pode". Nunca subir `.env.local` (já está no
   `.gitignore`; conferir antes com `git status`).
