# Onboarding e white-label

## Como uma empresa nova entra no kit

Jeito facil: abrir a pasta no Claude Code ou Codex e dizer "configurar empresa nova"
(skill `ct-onboarding`). Jeito manual:

1. Instalar conforme `docs/SETUP.md`.
2. Copiar `clients/_template/` para `clients/{slug-da-empresa}/`.
3. Preencher `brand-profile.md`, `design-system.md`, `competitors.md`.
4. Criar o arquivo `.workspace` apontando pro slug e rodar `npm run workspace:boot`.

Detalhe completo: `docs/SETUP.md`.

## Precedencia de configuracao

Quando duas fontes dizem coisas diferentes sobre o mesmo assunto, vence a mais
especifica:

```mermaid
flowchart TD
    A[clients/{slug}/brand-profile.md] --> B[clients/{slug}/design-system.md]
    B --> C[references/viral-playbook.md]
    C --> D[Demais references genericas]
```

Regra do cliente sempre manda sobre regra generica do framework.
