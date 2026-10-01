# App Review do Instagram: automação "comenta a palavra, recebe o link"

Objetivo: liberar Acesso Avançado para o app responder comentários e mandar uma DM (Private Reply)
quando alguém comenta a palavra-chave de um post da sua conta. Passo a passo completo em `PASSO-A-PASSO.md`.

## Permissões a solicitar (Acesso Avançado)
- `instagram_business_basic`
- `instagram_business_manage_comments`

`instagram_business_manage_messages` só é necessária se usar `"followGate": true` (checar se a pessoa
segue antes de entregar). Ela é mais difícil de aprovar. O modo padrão do kit não precisa dela.

## Pré-requisitos (quem é dono da conta faz)
1. **Verificação de Negócio** (Meta Business Suite, Configurações, Central de Segurança). Sem ela o Acesso Avançado não libera.
2. **Política de Privacidade pública** (URL). Modelo em `privacy-policy.html`: troque os trechos entre colchetes e publique.
3. Ícone do app (1024x1024) e categoria definida (Configurações do app, Básico).
4. URLs de desautorização e de exclusão de dados preenchidas (o `server.mjs` já atende as duas).

## Texto do caso de uso (colar no painel, em inglês: a revisão é em inglês)

Troque `[KEYWORD]` pela sua palavra-chave.

**instagram_business_manage_comments**
> Our app reads comments on the business's own Instagram media to detect a keyword ("[KEYWORD]") that followers use to request a free material. We only read comments on media owned by the connected business account. No comment data is stored beyond the comment ID (for deduplication).

**instagram_business_basic**
> Used to identify the connected business account (account id, username) to scope comment reading and replies to that account only.

**instagram_business_manage_messages** (somente se pedir esta permissão)
> When a follower comments the keyword "[KEYWORD]" on our own post, we send them a single private reply (DM) containing a link to a free material they explicitly requested by commenting. We do not send unsolicited messages. One reply per comment, triggered only by the user's own action.

## Roteiro do screencast (1 a 2 minutos)
1. Mostrar o painel do app e a tela de login do Instagram pedindo as permissões.
2. Mostrar a conta profissional conectada.
3. Mostrar um post real que convida a comentar a palavra.
4. Alguém comenta a palavra no post.
5. Mostrar a resposta pública e a DM chegando com o link.
6. Mostrar que é 1 DM por comentário (não é spam).

Narração (em inglês): o usuário pediu o material ao comentar, e o app responde só isso.
Gravador pronto: `record-screencast.mjs`.

## Fluxo de submissão
1. Verificação de negócio aprovada
2. Política de privacidade publicada e URL no painel
3. Textos dos casos de uso preenchidos (acima)
4. Screencast enviado
5. Enviar para análise
6. Aguardar (dias a cerca de 2 semanas)
7. Publicar o app (modo Live)
8. Comentar a palavra de OUTRA conta: a DM deve chegar (conferir `data/ig-webhook/events.log`)
