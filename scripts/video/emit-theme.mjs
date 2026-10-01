#!/usr/bin/env node
// Gera o tema Remotion da marca a partir de clients/{slug}/design-system.md.
// Uso: node scripts/video/emit-theme.mjs [slug]   (sem slug = marca ativa do .workspace)
import { resolveClient } from "../_lib/workspace-client.mjs"
import { writeThemeFile, brandFor } from "./_brand.mjs"

const slug = process.argv[2] || resolveClient()
if (!brandFor(slug).hasDesignSystem) {
  console.error(`clients/${slug}/design-system.md nao existe. Preencha a marca primeiro (ct-onboarding).`)
  process.exit(1)
}
console.log(`tema "${slug}" gravado em ${writeThemeFile(slug)}`)
