# Design System - [NOME DA EMPRESA]

## Cores

| Nome | Hex | Uso |
|------|-----|-----|
| Background | #000000 | Fundo principal |
| Surface | #000000 | Cards, modais |
| Texto | #FFFFFF | Texto principal |
| Texto secundario | #000000 | Subtitulos, meta |
| Destaque 1 | #000000 | Links, CTAs |
| Destaque 2 | #000000 | Badges, destaques |
| Sucesso | #000000 | Confirmacoes |
| Erro | #000000 | Alertas |

## Fontes

| Tipo | Fonte | Uso |
|------|-------|-----|
| Primaria | [Fonte] | Textos gerais |
| Secundaria | [Fonte] | Headlines |

## Carrossel Instagram

| Propriedade | Valor |
|-------------|-------|
| Largura | 1080px |
| Altura | 1350px |
| Max slides | 10 |
| Estilo | [minimalista / colorido / corporativo] |
| Foto de perfil | arquivo em clients/{slug}/assets/ (nome começando com perfil, avatar, foto ou logo) |

### Template oficial
Sem template próprio, usar o gerador do kit (skills/ct-carrossel-gen). Cores e fontes vêm do
`design-tokens.css` desta pasta (copiado do modelo; ajuste as cores e fontes da marca).

### Gabarito aprovado
[Pasta e motivo de um carrossel aprovado como referência. Vazio: ainda não há.]

### CTA do slide final
[Forma, cor, estrutura e exemplos aceitos e recusados. Vazio: CTA único e claro, conforme o playbook.]

### Zona segura
Margens: 80px lateral, 150px topo, 175px base (references/carousel-safe-zone.md). Esta marca pode aumentar, nunca diminuir.

## Thumbnail

| Propriedade | Valor |
|-------------|-------|
| Formato | 1280x720 |
| Fundo | [cor ou gradiente] |
| Destaque | [cor] |
| Fonte | [fonte] |
| Proibições | [o que nunca usar] |

## Infográfico

Formatos: horizontal 1200x800 e vertical 1080x1350. Nome: {nome}-horizontal.png e {nome}-vertical.png.
Cores e fontes: as da marca. Regras extras: [preencher].

## Brand Voice Visual

[Descreva o estilo visual: minimalista, colorido, corporativo, etc.]

## Logo / Foto

- Arquivo: [caminho do arquivo]
- Posicao padrao: [onde aparece nos slides]
- Tamanho: [dimensoes]

## Legenda de reel

Os agentes de vídeo usam estes valores. Já vem no padrão testado em produção (legenda por frase,
branca, maiúsculas, negrito, sem destaque nem contorno); a configuração ajusta cada item depois da
prévia (cor, fonte, tamanho, espaçamento, linhas, destaque da palavra falada, contorno). Seção apagada ou campo
entre [colchetes]: seguem o padrão de legenda do próprio agente.

- Estilo: por frase
- Cor do texto: #FFFFFF
- Cor de destaque da palavra falada: sem destaque
- Caixa: maiúsculas, peso: negrito
- Posição: terço inferior
- Fonte: Inter
- Tamanho: 76
- Espaçamento entre letras: -1
- Espaçamento entre linhas: 1.15
- Linhas no máximo: sem limite
- Palavras por página: 4
- Contorno: sem contorno
