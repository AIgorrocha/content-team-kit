import './_env.mjs'
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY
const VIDEO_ID = process.argv[2] // uso: node scripts/video/heygen-check.mjs <video_id>
if (!HEYGEN_API_KEY || !VIDEO_ID) {
  console.error('Uso: node scripts/video/heygen-check.mjs <video_id> (precisa de HEYGEN_API_KEY no .env.local)')
  process.exit(1)
}

const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${VIDEO_ID}`, {
  headers: { 'X-Api-Key': HEYGEN_API_KEY }
})
const data = await res.json()
console.log('Status:', data.data?.status)
if (data.data?.video_url) {
  console.log('URL:', data.data.video_url)
}
if (data.data?.error) {
  console.log('Error:', data.data.error)
}
console.log('Full:', JSON.stringify(data, null, 2).substring(0, 1000))
