# Créditos e licenças de terceiros

O Content Team AI é distribuído sob a licença MIT (`LICENSE`). Algumas partes vêm de
projetos de terceiros, cada uma com a própria licença:

| Parte | Onde está | Origem | Licença |
|---|---|---|---|
| MoneyPrinterTurbo (vídeo sem rosto) | `integrations/moneyprinter-turbo/` | github.com/harry0703/MoneyPrinterTurbo | MIT (arquivo `LICENSE` na pasta) |
| last30days (pesquisa dos últimos 30 dias) | `skills/last30days/` | github.com/mvanhorn/last30days-skill | MIT |
| Open Design (sistemas de design) | `skills/ct-od-design-import/` | github.com/nexu-io/open-design | Apache-2.0 (arquivo `LICENSE.open-design`) |
| Referências de Meta Ads | `references/ads/` e agentes `ct-ads-*` | github.com/AgriciDaniel/claude-ads (adaptado) | MIT |
| geo-content-optimizer | `skills/geo-content-optimizer/` | github.com/aaron-he-zhu/seo-geo-claude-skills | Apache-2.0 |
| diagram-design | baixado na hora do uso pela skill `skills/diagram-design/` | github.com/cathrynlavery/diagram-design | ver o repositório de origem |
| Prompts de Higgsfield | `skills/ct-higgsfield-prompt/` (adaptado) | github.com/OSideMedia/higgsfield-ai-prompt-skill | MIT |
| design-taste-frontend (taste-skill) | `skills/design-taste-frontend/` | github.com/leonxlnx/taste-skill | MIT (arquivo `LICENSE` na pasta) |

## Atenção: licença do Remotion

O motor de vídeo por código (`remotion/`, agentes `ct-video-remotion` e skills de vídeo) usa
o Remotion. O Remotion é gratuito para pessoas físicas e empresas pequenas, mas empresas
acima de um certo tamanho precisam comprar a licença de empresa. Confira as regras atuais
em https://www.remotion.dev/license antes de usar comercialmente.

## Ferramentas apenas indicadas (não incluídas no kit)

- Hypit (github.com/hypit-ai/hypit): licença própria, Apache-2.0 com condições (proíbe revender e oferecer como serviço hospedado). O kit só indica a instalação e traz o agente-ponte `ct-video-hypit`; nenhum código do Hypit é distribuído aqui.
- Skill oficial do Remotion (github.com/remotion-dev/skills): o repositório não declara licença, então não é copiada; instalação com `npx skills add remotion-dev/skills`.
- OpenShorts (github.com/mutonby/openshorts, MIT; a pasta `cloud/` deles tem licença comercial): clonado à parte pela skill `ct-openshorts`.
- HyperFrames (github.com/heygen-com/hyperframes, Apache-2.0): instalação indicada em `skills/ct-motion-code/catalogo-tecnicas.md`.
- Efeitos de motion em `skills/ct-motion-code/efeitos.md`: ideias inspiradas em material público de terceiros, reescritas; nenhum código ou vídeo copiado.
- image-to-code (leonxlnx/taste-skill), web-interface-guidelines (vercel-labs), awesome-design-md (VoltAgent): MIT, instalação indicada em `docs/SKILLS-EXTERNAS.md`.

As demais dependências instaladas pelo `npm install` trazem as próprias licenças em
`node_modules/`.
