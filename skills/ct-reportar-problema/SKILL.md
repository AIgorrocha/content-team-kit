---
name: ct-reportar-problema
description: "Envia a quem mantém o kit um relatório de problema ou uma sugestão de melhoria, sem segredo e sem dado da marca. Reúne o que aconteceu da conversa, gera o texto saneado, mostra a prévia, pede 'pode' e envia (GitHub, link no navegador ou texto pra mandar por WhatsApp/e-mail). Trigger: 'reportar problema', 'avisar o suporte', 'isso deu erro, manda pro suporte', 'sugerir melhoria'."
environment: local
metadata: { "kit": { "emoji": "📨" } }
---

# ct-reportar-problema: avisar o dono do kit

Dono: `ct-diretor`. Serve para **problema** (algo quebrou) e para **sugestão de melhoria**
(ex.: uma correção que deveria valer para todas as empresas). A pessoa é leiga: nada de jargão.

## Regra dura

NUNCA incluir chave, senha, token, conteúdo de `clients/` ou `content/`, nem dado de cliente da
pessoa (nomes, números, textos de peças, links privados). O script saneia (remove segredos,
e-mails e caminhos do computador), mas quem escreve a descrição também é responsável: descrever
o problema em termos gerais. Nunca ler `.env.local`. Sem "pode" da pessoa, nada é enviado.

## Passos

1. **Reunir da conversa** (perguntar só o que faltar, uma pergunta por vez):
   - o que a pessoa pediu ou tentava fazer;
   - o que deu errado (ou, na sugestão, o que poderia ser melhor);
   - a mensagem de erro, se houver (copiar como apareceu).
   Generalizar: trocar nome de marca, cliente e conteúdo por termos neutros ("a marca", "um post").
2. **Gerar o relatório:**
   `node scripts/kit/relatorio-problema.mjs --titulo "..." --descricao "..." [--erro "..."] --texto`
   O script já inclui versão do kit, sistema e Node.
3. **Mostrar a prévia COMPLETA** para a pessoa, exatamente como vai ser enviada, e perguntar:
   "Posso enviar assim?". Se ela achar algo sensível, tirar e gerar de novo.
4. **Só com o "pode", enviar, nesta ordem:**
   - **(a) Tem GitHub no computador:** se `gh auth status` funcionar, gravar o texto num arquivo
     temporário e rodar
     `gh issue create -R AIgorrocha/content-team-kit --title "..." --body-file <arquivo>`.
     Depois apagar o arquivo temporário e passar o link da solicitação criada.
   - **(b) Sem `gh`, mas com conta GitHub:** gerar o link com o mesmo comando trocando `--texto`
     por `--url` e abrir no navegador. Avisar: "vai pedir pra entrar numa conta GitHub (é
     grátis) e você clica no botão verde **Submit new issue**".
   - **(c) Sem GitHub:** entregar o texto pronto (`--texto`) e dizer: "copie e mande por
     WhatsApp ou e-mail para quem te passou o kit".
5. **Fechar** em 1 linha: o que foi enviado e por onde. Se for um problema que trava o trabalho
   agora, sugerir contornar sem mexer em `agents/` nem `skills/`.

## Notas

- A pessoa não precisa ter repositório nem entender "issue": dizer "relatório" ou "aviso".
- Sugestão vinda do loop de aprendizado (`docs/LOOP-DE-APRENDIZADO.md`): descrever a regra em
  termos gerais, sem o caso do cliente.
- Nada de travessão nos textos.
