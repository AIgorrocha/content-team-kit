// O Markdown do cliente é a fonte; instalações antigas podem configurar outro caminho.
import { lerRegrasDoArquivo } from "@/lib/sala/fontes"
import { arquivoRegrasCliente } from "../../../../../scripts/sala/arquivo-regras.mjs"

export async function lerRegrasLive(cliente: string) {
  const arquivo = arquivoRegrasCliente(cliente)
  return arquivo ? lerRegrasDoArquivo(arquivo, cliente) : []
}
