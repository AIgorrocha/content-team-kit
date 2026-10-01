// Hash compartilhado pelo mock e pelo provedor live (Tarefa A2): sha256 do conteudo de um
// arquivo, usado como `baseHash`/ConflitoEdicao em prompt, regra e futura escrita de peca.
import { createHash } from "node:crypto"

export function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex")
}
