import { config } from "dotenv"
config({ path: ".env.local", override: true })
config({ path: ".env" })
import { google } from "googleapis"
import { createReadStream } from "node:fs"
const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env
const VIDEO_ID = process.argv[2]
const THUMB = process.argv[3]
const o = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET)
o.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN })
const yt = google.youtube({ version: "v3", auth: o })
const r = await yt.thumbnails.set({ videoId: VIDEO_ID, media: { mimeType: "image/jpeg", body: createReadStream(THUMB) } })
console.log("thumb set ok:", JSON.stringify(r.data.items?.[0]?.default?.url || r.status))
