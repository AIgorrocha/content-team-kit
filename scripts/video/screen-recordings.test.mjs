import test from "node:test"
import assert from "node:assert/strict"
import { screenHtml } from "./screen-recordings.mjs"

const brand = { bg: "#101010", surface: "#202020", text: "#fff", textSecondary: "#aaa", accent: "#ff6600", accent2: "#00aa55" }

test("tela usa as cores da marca e escapa o texto", () => {
  const html = screenHtml({ type: "campos", title: "<b>x</b>", subtitle: "", fields: [{ label: "a", value: "b", highlight: true }] }, brand)
  assert.ok(html.includes("#ff6600") && html.includes("#101010"))
  assert.ok(html.includes("&lt;b&gt;x"))
})

test("cta destaca **trecho**", () => {
  assert.ok(screenHtml({ type: "cta", title: "Quer **ver**?", subtitle: "", button: "ok", note: "" }, brand).includes("<b>ver</b>"))
})

test("tipo desconhecido falha com mensagem clara", () => {
  assert.throws(() => screenHtml({ type: "xpto", title: "" }, brand), /tipo de tela desconhecido/)
})
