export async function lerCorpoLimitado(req: Request, limite: number): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > limite) throw new Error("Corpo muito grande")
  const leitor = req.body?.getReader()
  if (!leitor) return new Uint8Array()
  const partes: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await leitor.read()
      if (done) break
      total += value.length
      if (total > limite) { await leitor.cancel(); throw new Error("Corpo muito grande") }
      partes.push(value)
    }
  } finally { leitor.releaseLock() }
  const corpo = new Uint8Array(total)
  let posicao = 0
  for (const parte of partes) { corpo.set(parte, posicao); posicao += parte.length }
  return corpo
}
