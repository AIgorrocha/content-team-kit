# Instalação do Content Team AI

Guia de instalação numa máquina nova. Vale para qualquer empresa. Cada integração é
opcional: o que não for configurado fica desligado e o resto funciona.

Jeito mais fácil: abra a pasta no Claude Code (ou no Codex) e diga **"configurar empresa nova"**.
O assistente roda estes passos sozinho, pedindo permissão a cada um e explicando o que faz.
Este guia serve para quem prefere fazer à mão ou para conferir.

## 1. Programas necessários

| Programa | Para que serve | Obrigatório? | Como instalar (Windows) |
|---|---|---|---|
| Node.js 22 ou superior | Roda os scripts e o painel | Sim | `winget install OpenJS.NodeJS.LTS` |
| Git | Guarda o histórico da pasta | Sim | `winget install Git.Git` |
| Claude Code ou Codex | Onde os agentes conversam com você | Sim | https://code.claude.com ou Codex (OpenAI) |
| Docker Desktop | Banco de dados local e memória dos agentes | Sim (banco local) | `winget install Docker.DockerDesktop` |
| ffmpeg | Qualquer produção de vídeo | Só para vídeo | `winget install Gyan.FFmpeg` |
| uv (Python 3.12) | Vídeo sem rosto e legenda automática | Só para vídeo | `winget install astral-sh.uv` |
| Chrome | Pesquisa em sites e capturas de tela | Recomendado | Já vem na maioria dos computadores |

No Mac, use `brew install node git ffmpeg uv` e instale o Docker Desktop pelo site.

## 2. Instalar as dependências

Abra o terminal na pasta do kit e rode:

```bash
npm ci
cd remotion && npm ci && cd ..
npx playwright install chromium
```

O último comando instala o navegador que o time usa para gerar imagens de carrossel e ler sites.

> **Avisos do npm são normais.** Durante a instalação (`npm ci`) podem aparecer linhas com "deprecated",
> "vulnerabilities" e "install-scripts". São avisos esperados, não erro. O que importa é o
> comando terminar sem nenhuma linha com "ERR!".

> **Vídeo, primeira vez e Windows.** A primeira renderização de vídeo baixa cerca de 107 MB (o
> navegador do Remotion), então é normal demorar. No Windows, se aparecer
> `Failed to launch the browser process ... ENOENT`, a causa costuma ser caminho de pasta longo
> demais (limite de 260 caracteres). Instale o kit numa pasta de caminho curto (ex.: `C:\kit` ou
> `Documentos\kit`) ou aponte um Chrome já instalado com a variável `BROWSER_EXECUTABLE`
> (já suportada em `remotion/remotion.config.ts`).

## 3. Banco de dados (local, no seu computador)

1. Abra o Docker Desktop e espere ficar pronto.
2. `npm run supabase:start -- --configure`: inicia o banco e cria o `.env.local` (arquivo
   privado com as chaves). Se `.env.local` já existir, ele é preservado.
3. `npm run sala:migrate -- --all` e depois `npm run sala:check-db`: cria as tabelas e confere.
4. Abra o endereço do Studio mostrado no passo 2. Em Authentication, Users, Add user, crie
   seu acesso com e-mail e senha. Esse usuário só existe no seu banco local. O cadastro
   aberto fica desligado (`enable_signup = false` em `supabase/config.toml`): só o dono cria usuário.

Para parar: `npm run supabase:stop`. Para voltar: abra o Docker e rode
`npm run supabase:start`. Parar o banco não apaga os dados.

**Alternativa na nuvem (opcional):** crie um projeto em supabase.com, copie `Project URL`,
`anon key`, `service_role key` e a connection string para o `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) e aplique os arquivos de `supabase/migrations/`
em ordem pelo SQL Editor. O comando `--all` do passo 3 só funciona no banco local.
O projeto é seu: cada pessoa ou empresa usa o próprio Supabase, nunca o de outra. Na nuvem, desligue o
cadastro aberto (Authentication, Sign In / Providers, "Allow new users to sign up") e crie o seu usuário
à mão; as migrations já ligam a proteção por linha (RLS) nas tabelas.

Se não for usar o banco local, copie `.env.local.example` para `.env.local` e preencha à mão.

## 4. Cadastrar a sua marca

Jeito fácil: abra a pasta no Claude Code (ou Codex) e diga **"configurar empresa nova"**. A
skill `ct-onboarding` faz as perguntas uma por vez, lê seu site e suas redes, e cria tudo.

Jeito manual:
1. Copie `clients/_template/` para `clients/sua-marca/` (nome curto, minúsculo, sem acento).
2. Preencha `brand-profile.md` (quem é a marca, público, tom de voz) e `design-system.md`
   (cores, fontes, estilo). `competitors.md` e os demais são opcionais.
3. Copie `.workspace.example` para `.workspace` e troque o cliente para `client: sua-marca`.
4. Rode `npm run workspace:boot`.

Uma pasta de kit trabalha com uma marca por vez (a que está no `.workspace`).

## 5. Painel (Sala de Comando)

`npm run dev` e abra `http://localhost:5000/login`, entre com o acesso do passo 3.4 e vá em
`http://localhost:5000/sala/inicio`. Se a porta estiver ocupada:
`npm run dev -- --port 5057` e troque 5000 por 5057. Alternativa: `npm run sala:dev:local`
já sobe o painel apontando para o banco local.

Telas: Início, Visão geral, Trabalho, Peças, Calendário, Redes e Ajustes. Com mais de uma
marca em `clients/`, o Início mostra "Escolha o cliente". Uma instalação nova começa sem
peças. Para o quadro Trabalho mostrar o que cada agente está fazendo em tempo real, ver
`docs/SALA-TERMINAL.md` (opcional).

## 6. Conectar as redes (opcional, uma de cada vez)

Cada rede tem as próprias chaves. Sem a chave, a skill daquela rede avisa e não roda.
- Chave por chave: `docs/INTEGRACOES.md`.
- Conectar pelo painel: `docs/CONECTAR-REDES.md`.
- Conferir se as conexões estão válidas: `docs/CHECAGEM-CONEXOES.md`.

Ordem sugerida: Instagram, LinkedIn, Telegram (aprovação pelo celular, opcional), vídeo
(ffmpeg e uv) quando for fazer reel, YouTube e TikTok se a empresa usar.

## 6b. Navegador automático

No Claude Code, o arquivo `.mcp.json` já liga o navegador automático (Playwright): na primeira
vez o Claude Code pergunta se pode usar, e você aprova. No Codex, rode uma vez:
`codex mcp add playwright -- npx @playwright/mcp@latest`.

## 7. Memória dos agentes (opcional)

`integrations/ai-memory/` traz a memória de longo prazo (Docker). Sem ela o kit funciona,
mas os agentes não lembram decisões de uma conversa para outra. Configuração:
`npm run memory:setup`.

## 8. Checagens rápidas

| Comando | Confere |
|---|---|
| `npm run workspace:boot` | Marca ativa carregada |
| `npm run sala:check-db` | Banco acessível |
| `npm run check:join` | Peças publicadas cruzando com as métricas |
| `npm test` | Testes básicos do kit |
| `npm run test:kit` | Testes das ferramentas de atualização, relatório e chaves |
| `npm run kit:checar-chaves -- --rede instagram` | Mostra quais chaves de uma rede estão preenchidas (nunca o valor) |

## Cuidados

- Nunca compartilhe o `.env.local`: ele tem as chaves de acesso.
- Faça backup de `clients/` e `content/` antes de trocar de computador.
- Nada é publicado sem um "pode" seu.
