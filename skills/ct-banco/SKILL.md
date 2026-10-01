---
name: ct-banco
description: "Consultar e gerenciar dados nas tabelas ct_* via Supabase MCP"
---
# Supabase Query - Acesso ao Banco de Dados

Consulta e gerencia dados nas 30 tabelas `ct_*` usando o Supabase MCP server.

## Como Usar

Use as ferramentas do Supabase MCP (execute_sql, list_tables, etc.) para interagir com o banco.

## Tabelas Principais

| Tabela | Funcao |
|--------|--------|
| ct_agents | Agentes cadastrados (os de `agents/`) |
| ct_content_items | Conteudos (posts, carrosseis, videos) |
| ct_tasks | Tarefas delegadas entre agentes |
| ct_competitors | Concorrentes monitorados |
| ct_design_system | Identidade visual |
| ct_pipeline_stages | Etapas CRM (Lead→Won) |
| ct_contacts | Contatos CRM |
| ct_deals | Negocios |
| ct_subscribers | Assinantes email |
| ct_email_campaigns | Campanhas email |
| ct_email_sequences | Sequencias automaticas |
| ct_influencers | Influenciadores |
| ct_metrics_snapshots | Metricas por post/conta (grain='post'/'account'), usado por ct-instagram-analyzer, ct-social-intel |
| ct_social_insights | Insights computados (best-time, formatos), usado por ct-social-intel |

## Regras

- Preferir queries READ-ONLY (SELECT) por seguranca
- Sempre usar LIMIT em SELECTs
- Confirmar com usuario antes de INSERT/UPDATE/DELETE
- Nunca expor senhas ou API keys do banco
- Nunca rodar DROP ou TRUNCATE sem confirmacao explicita

## Pitfalls Supabase

- **PGRST205 (schema cache stale):** PostgREST pode devolver 404 "table not found" mesmo quando a tabela existe no PostgreSQL. Se isso ocorrer, validar com `pg` direto (`DATABASE_URL`) antes de concluir que a tabela não existe, e recarregar o cache (linha abaixo).
- **Schema cache reload:** `NOTIFY pgrst, 'reload schema';` força recarga do cache PostgREST (requer permissão).

## Exemplos

```sql
-- Listar conteudos agendados
SELECT title, platform, scheduled_at FROM ct_content_items WHERE status = 'scheduled' ORDER BY scheduled_at;

-- Contar agentes ativos
SELECT COUNT(*) FROM ct_agents WHERE status = 'idle';

-- Buscar concorrentes
SELECT handle, niche FROM ct_competitors WHERE is_active = true;

-- Pipeline CRM
SELECT name, position, color FROM ct_pipeline_stages ORDER BY position;
```
