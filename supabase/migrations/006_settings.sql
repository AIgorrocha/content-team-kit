CREATE TABLE IF NOT EXISTS ct_settings (
  id SERIAL PRIMARY KEY,
  settings_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ct_settings (settings_data, updated_at)
SELECT '{"platform_name":"Content Team AI","timezone":"America/Sao_Paulo","language":"pt-BR","default_platform":"instagram","notifications":{"email_digest":true,"content_ready":true,"campaign_sent":false,"agent_errors":true}}'::jsonb, NOW()
WHERE NOT EXISTS (SELECT 1 FROM ct_settings LIMIT 1);
