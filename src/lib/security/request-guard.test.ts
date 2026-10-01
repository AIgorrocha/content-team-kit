import { test } from "node:test"
import assert from "node:assert/strict"
import { checarPedido, safeEqual } from "./request-guard"

const env = { NODE_ENV: "development" } as NodeJS.ProcessEnv
const pedido = (metodo: string, headers: Record<string, string>) =>
  new Request("http://127.0.0.1:5000/api/x", { method: metodo, headers })

test("GET local passa; host estranho é recusado (DNS rebinding)", () => {
  assert.equal(checarPedido(pedido("GET", { host: "127.0.0.1:5000" }), env), null)
  assert.equal(checarPedido(pedido("GET", { host: "localhost:5000" }), env), null)
  assert.equal(checarPedido(pedido("GET", { host: "evil.example.com" }), env)?.status, 403)
})

test("POST de outro site é recusado, mesma origem passa", () => {
  const base = { host: "127.0.0.1:5000", "content-type": "application/json", "content-length": "2" }
  assert.equal(checarPedido(pedido("POST", { ...base, origin: "http://127.0.0.1:5000" }), env), null)
  assert.equal(checarPedido(pedido("POST", { ...base, origin: "https://evil.example.com" }), env)?.status, 403)
  assert.equal(checarPedido(pedido("POST", { ...base, origin: "http://127.0.0.1:3000" }), env)?.status, 403)
  assert.equal(checarPedido(pedido("POST", { ...base, origin: "null" }), env)?.status, 403)
})

test("POST com corpo text/plain é recusado (415); multipart passa", () => {
  const base = { host: "127.0.0.1:5000", "content-length": "5" }
  assert.equal(checarPedido(pedido("POST", { ...base, "content-type": "text/plain" }), env)?.status, 415)
  assert.equal(checarPedido(pedido("POST", { ...base, "content-type": "multipart/form-data; boundary=x" }), env), null)
})

test("host público configurado é aceito", () => {
  const e = { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://painel.exemplo.com", ALLOWED_HOSTS: "100.1.2.3" } as NodeJS.ProcessEnv
  const base = { "content-type": "application/json", "content-length": "2" }
  assert.equal(checarPedido(pedido("POST", { ...base, host: "painel.exemplo.com", origin: "https://painel.exemplo.com" }), e), null)
  assert.equal(checarPedido(pedido("GET", { host: "100.1.2.3:5000" }), e), null)
  assert.equal(checarPedido(pedido("GET", { host: "outro.com" }), e)?.status, 403)
})

test("safeEqual", () => {
  assert.equal(safeEqual("abc", "abc"), true)
  assert.equal(safeEqual("abc", "abd"), false)
  assert.equal(safeEqual("abc", "abcd"), false)
  assert.equal(safeEqual(undefined, "abc"), false)
  assert.equal(safeEqual("", ""), false)
})
