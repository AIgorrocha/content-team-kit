import type { ContentBlock } from "@/stores/carousel-store"

// Helpers genericos pra montar ContentBlock (slide DOM-based). Sem nada de
// cliente aqui: cada gerador de slide por cliente vive em src/lib/clients/{slug}.ts.
export function bid(): string {
  return crypto.randomUUID()
}

export function block(
  text: string,
  fontSize: number,
  fontWeight: string,
  opts?: Partial<ContentBlock>
): ContentBlock {
  return { id: bid(), type: "text", text, fontSize, fontWeight, ...opts }
}

export function imageBlock(text: string, opts?: Partial<ContentBlock>): ContentBlock {
  return { id: bid(), type: "image", text, fontSize: 0, fontWeight: "400", ...opts }
}
