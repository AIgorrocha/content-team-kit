# Fluxo de Sincronização: Content Team AI

## Princípio

**Supabase é a source of truth única.** Arquivos `.md` locais são a "origem humana" (onde você edita). Scripts de sync empurram pro banco. O painel lê direto do banco.

## Agentes

Editar um agente localmente:

```bash
# 1. Edita o .md
code agents/ct-redator.md

# 2. Sincroniza pro Supabase
npm run sync:agents
```

Resultado:
- `ct_agents` é atualizada (slug, display_name, role, config)
- `ct_agent_prompts` é atualizada (prompt_md = arquivo inteiro + frontmatter)

O painel `/agents` (aba Biblioteca) passa a ver a nova versão automaticamente.

## Skills

Editar uma skill localmente:

```bash
# 1. Edita a skill
code skills/ct-carrossel-gen/SKILL.md

# 2. Sincroniza
npm run sync:skills
```

Resultado:
- `ct_skills` é atualizada (name, description, category, content, path)

Frontend `/skills` faz fetch de `/api/skills` e mostra tudo do banco.

## Memória / Aprendizados

Vai direto pro `ct_agent_memory` via:
- Comandos dos agentes (quando decidem gravar)
- Edição manual no dashboard (rota futura)
- Inserção via SDK quando surgem aprendizados durante execução

Não há script de sync pra memória, ela nasce no banco.

## Clientes

Por enquanto não há sync automático. `ct_client_contexts` é populada manualmente. Um script de sync de clientes ainda não existe.

## Tabela-resumo

| Origem | Script | Destino Supabase | Lido por |
|--------|--------|------------------|----------|
| `agents/ct-*.md` | `npm run sync:agents` | `ct_agents`, `ct_agent_prompts` | Painel `/agents` |
| `skills/ct-*/SKILL.md` | `npm run sync:skills` | `ct_skills` | Painel `/skills`, agentes |
| (nasce no banco) | (sem script) | `ct_agent_memory` | agentes em runtime |
| `clients/{slug}/*.md` | (manual por enquanto) | `ct_client_contexts` | agentes em runtime |
