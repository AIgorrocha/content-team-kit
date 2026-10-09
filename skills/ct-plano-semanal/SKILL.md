---
name: ct-plano-semanal
description: "Gera planejamento editorial semanal cruzando brand-profile + design-system do cliente com top posts de pesquisa (ct_research_posts) e séries ativas. Trigger: 'plano semanal', 'programação da semana', 'planejar semana N'. Saída: markdown em content/{cliente}/planejamento/YYYY-semana-NN.md"
metadata: { "kit": { "emoji": "📅", "requires": { "env": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] } } }
---

# ct-plano-semanal: Planejamento Editorial Semanal Automatizado

Gera markdown de planejamento da próxima semana cruzando:

1. **Brand + design** do cliente (`clients/{slug}/brand-profile.md` + `design-system.md`)
2. **Top posts** recentes de `ct_research_posts` (ordenados por engajamento, filtrados por plataforma relevante)
3. **Cadência** da marca (linha "Ritmo:" da seção "Preferências de formato" do `brand-profile.md`)
4. **Diretrizes de distribuição** (formato por plataforma; dia e horário vêm do `ct-social-intel`/cockpit, sem dado o plano diz "a definir")

## Quando usar

Dispara via:
- Pedido em linguagem natural ("plano semanal", "planejar semana 18"): o diretor chama esta skill
- Linha de comando: `node skills/ct-plano-semanal/gerar.js --cliente {slug} --semana 18`

## Regras

- **NÃO** reescreve plano existente da mesma semana (se arquivo existe, aborta com warning, usar flag `--force` pra regerar)
- **NÃO** inventa dados, todos insights vêm de `ct_research_posts` real
- **Cadência por cliente:** o script lê a linha `Ritmo:` da seção "Preferências de formato" de `clients/{slug}/brand-profile.md` (ex.: `Ritmo: 3 peças por semana` ou `Ritmo: 2 carrosséis, 1 reel, 4 stories`). Sem essa linha (ou com o modelo ainda não preenchido), usa o default: 2 feeds, 3 stories, 1 reel.
- **Trilha de teste de formatos** `[HIPOTESE]`: marca sem formato validado no cockpit declara a trilha em "Preferências de formato" do `brand-profile.md` (regra do diretor em `agents/ct-diretor.md`). O plano então escreve, na coluna Formato de cada vídeo curto, o formato testado (um por vez, 2 posts de cada), reserva o volume declarado (sugestão: mínimo 3 por semana) e, depois de escolhido o campeão, mantém alguns slots de teste. O resultado se mede por seguidor novo, separado de visualização. O script não lê essa trilha: o diretor ou o usuário preenche os formatos no markdown gerado.
- **Credenciais:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` (depois `.env`). Sem elas, o plano sai sem a parte de top posts.

## Input (CLI)

```bash
node gerar.js --cliente {slug} --semana 18
node gerar.js --cliente {slug}   # default: próxima semana ISO
```

## Output

Gera arquivo(s):
- `content/{slug}/planejamento/2026-semana-18.md` (um por cliente processado)

Formato do markdown gerado:

```markdown
# Plano Semana 18, {slug} (27/abr a 02/mai)

## Pilares ativos desta semana
- [carregado de brand-profile]

## Insights top posts (últimos 14 dias)
- [top 5 de ct_research_posts filtrado]

## Calendário
| Dia | Horário | Plataforma | Formato | Tema | Hook | Agente |
|-----|---------|------------|---------|------|------|--------|
| ... |
```

## Dependências

Node.js + `@supabase/supabase-js`. Instalar:
```bash
cd skills/ct-plano-semanal
npm install
```

## Teste do parser de cadência

```bash
node --test skills/ct-plano-semanal/gerar.test.js
```

## Dry-run

```bash
node gerar.js --cliente {slug} --semana 18 --dry-run
```
Imprime markdown no stdout sem gravar arquivo.

## Integração

- Rodar manualmente segunda de manhã
- Opcional: agendar uma rotina semanal (ex.: segunda 6h); o padrao e rodar manualmente, sob demanda
