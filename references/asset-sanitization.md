# Higienizacao de asset visual (FONTE CANONICA)

Vale para TODO asset visual (foto, render, prancha, frame de video, print) tirado de acervo
de cliente (Google Drive, pasta de projeto, material enviado pelo cliente) que vai virar
conteudo publico. Referenciado por `agents/ct-diretor.md`. Nao duplicar a regra: linkar para ca.

## Regra dura

**Filtro por NOME de arquivo ou de pasta NAO substitui inspecao visual.**

Nome de arquivo pega o obvio (orcamento, curva ABC, cotacao, Termo de Referencia, SEI).
Nao pega o que esta DENTRO do pixel. Caso real: a triagem
por nome passou limpa, e so o segundo passe olhando imagem por imagem achou duas placas de
veiculo legiveis numa foto de visita e o banner do contratante em outra.

## Segundo passe obrigatorio (asset por asset, ampliado)

Abrir CADA asset aprovado e olhar de fato, em tamanho real. **Miniatura engana: ampliar
antes de dar como limpo.** Procurar:

- placa de veiculo
- rosto identificavel / crianca / terceiro nao autorizado
- cracha, uniforme com nome, etiqueta de visitante
- razao social por extenso (do contratante ou de terceiro)
- CREA / CAU / numero de ART / RRT
- QR code (qualquer um: carrega link e dado)
- numero de processo (SEI, licitacao, contrato)
- logotipo do contratante
- endereco, placa de rua, numero de lote/quadra
- nome proprio em selo, carimbo, banner, placa de obra

Atencao especial a **prancha**: o selo traz razao social por extenso, local, CREA, QR code e
responsavel tecnico embutidos no proprio desenho. Prancha nunca passa sem inspecao do selo.

Carimbo da propria empresa: tag so em nome, endereco e QR do cliente final. Logo da empresa e titulo da folha ficam.
Carimbo de terceiro: cobrir o bloco inteiro (logo ate o fim do selo). Nao deixar tarja no texto e o selo visivel. Nao abrir um buraco enorme que coma 3D/legenda/notas.

## Tratamento

| Situacao | Tratamento |
|---|---|
| Dado sensivel na BORDA do enquadramento | **CROP** (cortar fora, nao tapar) |
| Dado sensivel EMBUTIDO no meio da imagem | **BLUR DESTRUTIVO** |

Blur destrutivo = pixelizar a 1/28 da resolucao da regiao + reamostrar em NEAREST +
gaussiano forte por cima. Precisa ser irreversivel por sharpening.

**Nao serve:** blur leve, desfoque gaussiano sozinho, pixel grosso, tarja semitransparente,
emoji/adesivo por cima. Tudo isso e recuperavel ou vaza pelas bordas.

## Fechamento

Depois de tratar, olhar de novo o asset final ampliado. So entao ele esta liberado para
entrar em carrossel, reel, story ou post.
