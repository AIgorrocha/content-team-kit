# Passo a passo: DM automática do Instagram (comenta a palavra, recebe o link)

Serve para montar, do zero e de graça, o fluxo "comenta GUIA que eu te mando o material". O serviço é o
`server.mjs` desta pasta. Ele usa a API oficial do Instagram, então não há risco de banimento por robô.

O que ele faz: alguém comenta a palavra-chave no seu post, o serviço responde em público
("Te mandei no direct") e manda o material no privado (Private Reply). Comentário sem palavra-chave
não recebe nada, para você continuar respondendo as outras pessoas.

Faça na ordem: PARTE 1, PARTE 2, PARTE 3, PARTE 4.

---

## PARTE 1. Criar o app na Meta (1 vez)

Precisa de uma conta Instagram **profissional** (Business ou Creator).

1. Abra https://developers.facebook.com/apps e clique em **Criar app**.
2. Escolha o caso de uso **Instagram** (API do Instagram com login do Instagram).
3. No painel do app, anote:
   - **ID do app do Instagram** (vai em `IG_APP_ID`)
   - **Chave secreta do app do Instagram** (vai em `INSTAGRAM_APP_SECRET`)
4. Em **Configuração da API**, gere o **token de acesso** da sua conta profissional (vai em `INSTAGRAM_ACCESS_TOKEN`)
   e anote o **ID da conta do Instagram** (vai em `INSTAGRAM_USER_ID`).
5. Invente uma senha qualquer para o webhook (vai em `IG_VERIFY_TOKEN`). É só um código que a Meta e o
   seu servidor combinam entre si.

Coloque tudo no `.env.local` (arquivo privado, nunca vai para o GitHub):

```
INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_APP_SECRET=
IG_APP_ID=
IG_VERIFY_TOKEN=
PUBLIC_BASE=https://bot.suaempresa.com.br
```

`PUBLIC_BASE` é o endereço público (HTTPS) onde o servidor vai responder, **sem barra no final**.
Sem ele o login da Meta e a URL de exclusão de dados não funcionam (o servidor avisa no log).

## PARTE 2. Colocar o servidor no ar

A Meta só fala com endereço público HTTPS. `localhost` não serve. Duas saídas:

- **Servidor/VPS seu** com um domínio apontado (o mais estável).
- **Túnel** (Cloudflare Tunnel ou ngrok) apontando para a porta do serviço. Serve para testar.

1. Crie a pasta das regras e copie o modelo:
   ```
   mkdir -p data/ig-webhook
   cp scripts/ig-webhook/rules.example.json data/ig-webhook/rules.json
   ```
   (no Windows: crie a pasta `data\ig-webhook` e copie o arquivo `rules.example.json` para dentro, com o nome `rules.json`)
2. Edite `data/ig-webhook/rules.json` (palavra, link e texto da DM; veja `skills/ct-dm-auto/SKILL.md`).
3. Suba o serviço (precisa do Node 22 ou mais novo):
   ```
   node --env-file=.env.local scripts/ig-webhook/server.mjs
   ```
   A porta padrão é 3010 (mude com `PORT`). Teste: abra `PUBLIC_BASE/ig-webhook/health`, deve
   mostrar `ok rules=1 mode=...`.

## PARTE 3. Ligar o webhook na Meta

No painel do app, em **Webhooks** do Instagram:

1. **URL de callback:** `PUBLIC_BASE/ig-webhook`
2. **Token de verificação:** o mesmo valor de `IG_VERIFY_TOKEN`
3. Clique em verificar (o servidor precisa estar no ar). Depois assine o campo **comments**.
4. Em **Login com o Instagram**, registre a URL de redirecionamento: `PUBLIC_BASE/auth/callback`
5. Em **Configurações do app, Básico**, preencha:
   - URL de desautorização: `PUBLIC_BASE/auth/deauthorize`
   - URL de exclusão de dados: `PUBLIC_BASE/auth/data-deletion`
   - URL da política de privacidade (modelo em `scripts/ig-webhook/privacy-policy.html`: troque os trechos entre colchetes, publique em qualquer hospedagem, por exemplo Vercel, e cole o endereço)
   - ícone do app (1024x1024) e categoria

Enquanto o app está em modo **Desenvolvimento**, só contas com papel no app (você e testadores) disparam a
automação. Para qualquer seguidor usar, é preciso o App Review (PARTE 4).

## PARTE 4. App Review (liberar para o público)

Modo seguro do kit: só **Private Reply** em comentário, sem mensagem livre. Pede só duas permissões:
`instagram_business_basic` e `instagram_business_manage_comments`. Por isso use `"followGate": false`
nas regras (o "só entrego se seguir" exige `instagram_business_manage_messages`, mais difícil de aprovar).

1. **Verificação de Negócio** (1 vez): https://business.facebook.com/settings, Central de Segurança,
   Iniciar verificação. Precisa de dados da empresa (nome legal, CNPJ, endereço) e um documento que comprove.
   Pode levar de horas a dias. Sem CNPJ, em alguns casos dá para tentar como pessoa.
2. **Gravar o screencast** (1 a 2 minutos, MP4), mostrando nesta ordem: o painel logado, a tela de login do
   Instagram pedindo as permissões, um post real da conta, alguém comentando a palavra, a resposta pública e a
   DM chegando com o link, 1 DM só por comentário. Dá para gravar com a Game Bar do Windows (Win + G) ou usar
   o gravador pronto: `node --env-file=.env.local scripts/ig-webhook/record-screencast.mjs`
   (variáveis no topo do arquivo; precisa do ffmpeg).
3. **Pedir acesso avançado:** no painel, Casos de uso, Permissões e recursos, em cada permissão clique
   em Ações, Solicitar acesso avançado. Cole o texto do caso de uso de `scripts/ig-webhook/APP-REVIEW.md`
   (em inglês, a revisão é em inglês) e envie o vídeo. Depois clique em **Enviar para análise**.
4. **Aguarde** (dias a cerca de 2 semanas). A Meta responde por e-mail e notificação.
5. **Depois de aprovado:** em **Publicar**, mude o app para **Ativo (Live)**. Teste comentando a palavra
   de OUTRA conta e confira o `events.log` (fica em `data/ig-webhook/events.log`).

## Dia a dia

- Regra nova: edite `data/ig-webhook/rules.json` e recarregue sem reiniciar. Na máquina do servidor:
  `curl http://127.0.0.1:3010/ig-webhook/reload`. De fora só funciona se você definir `RELOAD_TOKEN` no
  `.env.local` e abrir `PUBLIC_BASE/ig-webhook/reload?token=SEU_TOKEN` (sem o token, a resposta é 403 de propósito).
- Saúde do serviço: `PUBLIC_BASE/ig-webhook/health`. Histórico: `data/ig-webhook/events.log`.
- O token do Instagram vence. Se a DM parar de sair, veja o log e gere outro token.
- Só escreva "comenta PALAVRA" numa legenda depois que a palavra estiver cadastrada e recarregada.

## Variáveis de segurança (todas opcionais, no `.env.local`)

| Variável | Padrão | Para que serve |
|---|---|---|
| `HOST` | `127.0.0.1` | Endereço onde o servidor escuta. Padrão: só a própria máquina (o proxy HTTPS, como o nginx, fica na frente). Mude só se souber o que faz. |
| `MAX_BODY_BYTES` | `1048576` (1 MB) | Tamanho máximo de um pedido. Maior que isso: erro 413, sem nem checar assinatura. |
| `MAX_PER_USER_HOUR` | `3` | Máximo de respostas por pessoa por hora. Acima disso só registra no log, não envia. |
| `MAX_PER_MINUTE` | `30` | Teto global de envios por minuto, mesma regra. |
| `RELOAD_TOKEN` | vazio | Senha para recarregar as regras de fora da máquina (`?token=`). Vazio: só pedido local. |
