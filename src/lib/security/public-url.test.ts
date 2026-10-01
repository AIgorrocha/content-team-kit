import { test } from "node:test"
import assert from "node:assert/strict"
import { assertPublicUrl, ipBloqueado } from "./public-url"

test("recusa IPs internos", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "100.100.100.100", "0.0.0.0", "::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.equal(ipBloqueado(ip), true, ip)
  }
})

test("aceita IPs públicos", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(ipBloqueado(ip), false, ip)
  }
})

test("assertPublicUrl recusa esquema e host internos", async () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com", "http://127.0.0.1/", "http://localhost:5000/", "http://[::1]/",
    "http://169.254.169.254/latest/meta-data", "http://100.84.154.51/", "https://app.localhost/", "nao e url"]) {
    await assert.rejects(assertPublicUrl(u), u)
  }
})

test("assertPublicUrl aceita IP público e host liberado", async () => {
  assert.equal((await assertPublicUrl("https://8.8.8.8/x")).hostname, "8.8.8.8")
  assert.equal((await assertPublicUrl("http://127.0.0.1:54321/v", ["127.0.0.1"])).port, "54321")
})
