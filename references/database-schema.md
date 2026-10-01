# Database Schema - Content Team AI

30 tabelas com prefixo `ct_*` no Supabase (project Supabase proprio do framework, configurado em `.env.local`). NAO confundir com o banco de outro produto da mesma empresa, que e separado. ct_content_items usa `client_slug` (ex: acme, beta).

## Tabelas Core

### ct_agents
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| slug | VARCHAR(50) | Identificador unico (ex: content-director) |
| display_name | VARCHAR(100) | Nome de exibicao |
| role | VARCHAR(50) | Funcao |
| status | VARCHAR(20) | idle, working, error |
| last_active_at | TIMESTAMPTZ | Ultima atividade |
| config | JSONB | Configuracoes extras |

### ct_tasks
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| title | VARCHAR(255) | Titulo da tarefa |
| description | TEXT | Descricao detalhada |
| assigned_agent | VARCHAR(50) | FK → ct_agents.slug |
| created_by | VARCHAR(50) | Quem criou |
| status | VARCHAR(20) | pending, in_progress, completed, failed |
| priority | INT | 0-5 |
| due_at | TIMESTAMPTZ | Prazo |
| result | JSONB | Resultado da tarefa |
| parent_task_id | UUID | FK → ct_tasks.id (subtarefas) |

### ct_audit_log
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | BIGSERIAL | PK |
| agent | VARCHAR(50) | Qual agente |
| action | VARCHAR(100) | O que fez |
| target_type | VARCHAR(50) | Tipo do alvo |
| target_id | UUID | ID do alvo |
| details | JSONB | Detalhes |

## Tabelas de Conteudo

### ct_content_items
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| title | VARCHAR(255) | Titulo |
| content_type | VARCHAR(30) | post, carousel, reel, video, article |
| status | VARCHAR(20) | idea, draft, review, scheduled, published |
| platform | VARCHAR(30) | instagram, linkedin, youtube, email |
| scheduled_at | TIMESTAMPTZ | Data agendada |
| published_at | TIMESTAMPTZ | Data publicacao |
| caption | TEXT | Legenda |
| hashtags | TEXT[] | Array de hashtags (Instagram/TikTok/YouTube); vazio quando a peca for so de LinkedIn (ZERO hashtag no LinkedIn, regra do framework) |
| media_urls | TEXT[] | URLs de midia |
| approval_status | VARCHAR(20) | pending, approved, rejected |

### ct_content_series
Series de conteudo (ex: "Dica da Semana"). Campos: id, name, description, frequency, platforms, is_active.

### ct_content_series_items
Liga conteudos a series. Campos: series_id, content_id, sequence_num.

## Tabelas CRM

### ct_pipeline_stages
6 etapas: Lead, Qualified, Proposal, Negotiation, Won, Lost.

### ct_contacts
Contatos CRM. Campos: id, name, email, phone, instagram, linkedin, company, source, tags, notes.

### ct_deals
Negocios. Campos: id, contact_id, title, value, currency, stage_id, status, expected_close_at.

### ct_deal_activities
Atividades de cada negocio. Campos: id, deal_id, contact_id, activity_type, description, performed_by.

## Tabelas Email Marketing

### ct_subscribers
Assinantes. Campos: id, email, name, source, lead_magnet_id, tags, status.

### ct_email_campaigns
Campanhas. Campos: id, name, subject, body_html, body_text, status, campaign_type, scheduled_at, stats.

### ct_email_sequences
Sequencias automaticas. Campos: id, name, description, trigger_event, is_active.

### ct_email_sequence_steps
Passos de cada sequencia. Campos: id, sequence_id, step_number, delay_hours, subject, body_html.

### ct_lead_magnets
Iscas digitais. Campos: id, name, description, file_url, landing_page_url, download_count.

## Tabelas Design

### ct_design_system
Identidade visual. Campos: id, owner, logo_url, fonts (JSONB), colors (JSONB), carousel_style (JSONB), brand_voice.

## Tabelas Monitoramento

### ct_competitors
8 concorrentes. Campos: id, handle, platform, display_name, niche, is_active, last_scraped_at.

### ct_competitor_posts
Posts analisados. Campos: id, competitor_id, platform_post_id, post_type, caption, engagement, is_viral.

### ct_metrics_snapshots
Historico de metricas PROPRIAS por post/conta ao longo do tempo (substitui historico Metricool, gratis).
Gravado pelos analyzers (ct-instagram/linkedin/youtube/tiktok-analyzer) via skills/_shared/metrics-writer.cjs.
Campos: id, client_slug, platform, account_handle, grain (account|post), post_id, post_url, post_type,
published_at, snapshot_date, followers, reach, impressions, likes, comments, shares, saves, views,
engagement_rate, metrics (jsonb catalogo completo), source, created_at.
Unico: (platform, post_id, snapshot_date) - upsert idempotente diario. Conta usa post_id sintetico `__acct__:cliente:handle`.

### ct_social_insights
Insights computados dos snapshots. kind=`best_time` (heatmap 7x24 + best_slots + by_weekday/hour/format,
gerado por ct-social-intel) e kind=`cockpit` (painel consolidado, gerado por ct-social-cockpit).
Campos: id, client_slug, platform, kind, window_days, sample_size, payload (jsonb), computed_at.
Le sempre a linha mais recente por (client_slug, platform, kind).

## Tabelas Influenciadores

### ct_influencers
Campos: id, name, handles (JSONB), niche, followers_approx, status, notes.

### ct_collaborations
Campos: id, influencer_id, type, status, scheduled_at, notes, content_id.

## Tabelas Multi-Tenant (Dashboard)

- ct_users: Usuarios do dashboard
- ct_tenants: Tenants (multi-empresa)
- ct_tenant_members: Membros
- ct_api_keys: Chaves API
- ct_plans: Planos (free/starter/pro/enterprise)
- ct_subscriptions: Assinaturas
- ct_usage: Uso mensal
- ct_brand_profile: Perfil da marca (onboarding)
- ct_credentials: Credenciais criptografadas

## Indexes

```sql
CREATE INDEX idx_ct_tasks_status ON ct_tasks(status);
CREATE INDEX idx_ct_tasks_agent ON ct_tasks(assigned_agent);
CREATE INDEX idx_ct_content_status ON ct_content_items(status);
CREATE INDEX idx_ct_content_platform ON ct_content_items(platform);
CREATE INDEX idx_ct_content_scheduled ON ct_content_items(scheduled_at);
CREATE INDEX idx_ct_deals_stage ON ct_deals(stage_id);
CREATE INDEX idx_ct_subscribers_status ON ct_subscribers(status);
CREATE INDEX idx_ct_competitor_posts_competitor ON ct_competitor_posts(competitor_id);
CREATE INDEX idx_ct_audit_agent ON ct_audit_log(agent);
```
