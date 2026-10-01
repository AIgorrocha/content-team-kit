# Instruções para o Codex

As regras desta pasta estão em `CLAUDE.md` (valem para qualquer assistente). Leia o
`CLAUDE.md` inteiro antes de qualquer tarefa e siga, inclusive a tabela "Primeiro uso e frases
que disparam skills" (configurar empresa nova, continuar configuração, conectar as redes,
atualizar o kit, reportar problema).

Diferenças no Codex:
- Onde o `CLAUDE.md` diz "delegar a um sub-agente", use os sub-agentes do Codex se estiverem
  disponíveis; se não, abra `agents/ct-X.md` e execute você mesmo aquele papel, uma parte por vez.
- Skills ficam em `skills/{nome}/SKILL.md`: abra e siga o passo a passo.
- Navegador automático: o `.mcp.json` vale só para o Claude Code. No Codex, com permissão da
  pessoa, rode uma vez `codex mcp add playwright -- npx @playwright/mcp@latest`.
- O quadro "Trabalho" do painel recebe eventos só do Claude Code (hook em `.claude/settings.json`).
  No Codex o resto funciona igual.
