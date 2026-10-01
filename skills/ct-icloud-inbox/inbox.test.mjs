import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ingest, listMedia, setupInbox } from "./inbox.mjs"

const dir = mkdtempSync(join(tmpdir(), "ct-icloud-"))
const inbox = join(dir, "inbox")
mkdirSync(inbox)
writeFileSync(join(inbox, "take.mp4"), Buffer.alloc(128, 1))
writeFileSync(join(inbox, "nota.txt"), "ignore")
process.env.CT_ICLOUD_INBOX = inbox

const listed = listMedia(inbox)
if (listed.length !== 1) throw new Error("list deve pegar so mp4")

const r = ingest({ slug: "acme", root: dir })
if (!r.ok) throw new Error("ingest falhou")
if (r.copied.length !== 1) throw new Error("devia copiar 1")
const again = ingest({ slug: "acme", root: dir })
if (again.copied.length !== 0) throw new Error("segunda vez nao recopia")
if (!readFileSync(r.copied[0].to).equals(Buffer.alloc(128, 1))) throw new Error("copia nao e byte-a-byte")

const s = setupInbox("acme")
if (!s.fallback) throw new Error("setup")
console.log("ok")
