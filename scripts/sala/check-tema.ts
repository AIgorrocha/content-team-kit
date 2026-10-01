// Smoke test da conversão de cor com alfa do tema da Sala de Comando (Tarefa 16).
// Roda com `npx tsx scripts/sala/check-tema.ts`. Prova a correção da regressão em que
// --border (rgba com alfa) virava opaco 255 255 255 em vez de ser compositado sobre o
// fundo do cliente (ficando cinza sutil, não branco).
import { corParaRgb } from "../../src/lib/sala/tema"

function aproxIgual(valor: string, esperado: [number, number, number], tolerancia = 1): boolean {
  const partes = valor.split(" ").map(Number)
  return partes.every((v, i) => Math.abs(v - esperado[i]) <= tolerancia)
}

function main() {
  // rgba(255,255,255,0.08) sobre #0D0D0D (13,13,13): 255*.08 + 13*.92 ≈ 32.
  const resultado = corParaRgb("rgba(255, 255, 255, 0.08)", [13, 13, 13])
  console.log(`corParaRgb(rgba(255,255,255,0.08), fundo=13 13 13) = "${resultado}"`)
  if (!resultado || !aproxIgual(resultado, [32, 32, 32])) {
    throw new Error(`esperado ~"32 32 32", veio "${resultado}"`)
  }

  // Alfa 1 (opaco) não deve compositar: cor sai igual ao valor de entrada.
  const opaco = corParaRgb("rgb(74, 144, 217)", [13, 13, 13])
  console.log(`corParaRgb(rgb opaco) = "${opaco}"`)
  if (opaco !== "74 144 217") throw new Error(`cor opaca não deveria compositar, veio "${opaco}"`)

  // hex 8 dígitos com alfa também compõe.
  const hexAlfa = corParaRgb("#FFFFFF14", [13, 13, 13]) // 0x14/255 ≈ 0.0784, bem perto de 0.08
  console.log(`corParaRgb(#FFFFFF14) = "${hexAlfa}"`)
  if (!hexAlfa || !aproxIgual(hexAlfa, [32, 32, 32], 2)) {
    throw new Error(`esperado ~"32 32 32" pro hex com alfa, veio "${hexAlfa}"`)
  }

  console.log("\nTUDO OK.")
}

main()
