# Ads Approval Worker: setup em servidor sempre ligado (opcional)

Worker automático que executa otimizações aprovadas pelo usuário no dashboard.

Ele é opcional e precisa rodar em um servidor ou computador sempre ligado (por exemplo, um servidor Linux
alugado ou uma máquina do escritório que não desliga). Se você não usa as aprovações de anúncios no
dashboard, pode ignorar este documento.

As tabelas (`ct_ad_campaigns`, `ct_ad_insights`, `ct_ad_recommendations`, `ct_ad_approvals`,
`ct_ad_actions_log`) são criadas pela migration `supabase/migrations/20260930_ads_posts_inspiracao.sql`.
Aplique as migrations antes de rodar qualquer script daqui.

## Fluxo

```
Dashboard (admin aprova)
  → cria registro em ct_ad_approvals (nasce "pending"; ao aprovar vira "approved")
    → Worker roda no servidor a cada 5 minutos
      → Lê aprovações status="approved", executed_at IS NULL
        → Chama Meta API (pause/activate/update_budget)
          → Registra em ct_ad_actions_log
            → Marca approval como "executed"
```

## Setup no servidor

### 1. Copiar o script pro servidor

```bash
scp scripts/infra/ads-approval-worker.mjs <usuario>@<ip-do-servidor>:<pasta-do-kit>/scripts/infra/
```

### 2. Instalar dependências (uma vez)

```bash
ssh <usuario>@<ip-do-servidor>
cd <pasta-do-kit>
npm install @supabase/supabase-js pg
```

### 3. Configurar env vars

Adicionar em `<pasta-do-kit>/.env`:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
META_ACCESS_TOKEN=<meta-system-user-token>
DATABASE_URL=<string-de-conexao-postgres-do-seu-supabase>
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `META_ACCESS_TOKEN` são do worker de aprovações.
`DATABASE_URL` é só do sync diário (`ads-sync-daily.mjs`), que lê as contas com `ad_account_id`
em `ct_instagram_accounts`.

### 4. Testar manualmente

```bash
cd <pasta-do-kit>
set -a && source .env && set +a
node scripts/infra/ads-approval-worker.mjs
```

### 5. Configurar cron (roda a cada 5 minutos)

```bash
crontab -e
```

Adicionar os jobs (em Windows, use o Agendador de Tarefas com os mesmos comandos):
```
# Executa aprovações pendentes a cada 5 minutos
*/5 * * * * cd <pasta-do-kit> && set -a && source .env && set +a && node scripts/infra/ads-approval-worker.mjs >> /var/log/ads-approval.log 2>&1

# Sincroniza dados Meta Ads diariamente às 7h BRT
0 7 * * * cd <pasta-do-kit> && set -a && source .env && set +a && node scripts/infra/ads-sync-daily.mjs >> /var/log/ads-sync.log 2>&1
```

As recomendações (`ct_ad_recommendations`) não são geradas por cron: quem grava é o agente `ct-trafego`,
quando você pede a análise diária. O sync só traz campanhas e métricas.

### 6. Verificar logs

```bash
tail -f /var/log/ads-approval.log
```

## Ações Suportadas

| action_type | Descrição | proposed_value |
|-------------|-----------|----------------|
| `pause` | Pausar campanha | N/A |
| `activate` | Ativar campanha | N/A |
| `update_budget` | Alterar orçamento diário | Valor em BRL (ex: "25.00") |

## Segurança

- Worker só executa approvals com `status = 'approved'` (marcado no dashboard)
- Nunca executa automaticamente, sempre precisa aprovação humana
- Log completo em ct_ad_actions_log + /var/log/ads-approval.log
- Se falhar, marca como `failed` e guarda erro
- Token Meta nunca exposto, apenas em variáveis de ambiente do servidor
