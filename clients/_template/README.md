# Client Template

## Como usar

1. Copie esta pasta inteira para `clients/nome-do-cliente/`
2. Preencha cada arquivo com os dados do cliente:
   - `brand-profile.md`: Identidade, tom de voz, publico, pilares
   - `design-system.md`: Cores, fontes, estilo visual
   - `competitors.md`: Concorrentes a monitorar
3. Copie `.workspace.example` para `.workspace` com `client: nome-do-cliente` e rode `npm run workspace:boot`
4. Pronto! Os agentes vao usar automaticamente os dados do cliente ativo.

## Arquivos

| Arquivo | Obrigatorio | Descricao |
|---------|-------------|-----------|
| brand-profile.md | Sim | Identidade da marca, tom de voz, publico-alvo |
| design-system.md | Sim | Cores, fontes, especificacoes visuais |
| competitors.md | Opcional | Concorrentes para monitorar |
| regras-cliente.md | Sim (vem vazio) | Correcoes e pedidos permanentes da marca |
| voice-patterns.md | Opcional | Expressoes e jeito de falar da marca |
| integracoes.md | Opcional | Estado das conexoes (sem senhas) |
| preferred-systems.md | Opcional | Base visual de landing page, deck e blog |
| design-tokens.css | Recomendado | Cores, fontes e medidas usadas pelo gerador de carrossel (troque as cores pelas da marca) |
| configuracao-estado.md | Automático | Andamento da configuração ("continuar configuração" lê daqui) |
