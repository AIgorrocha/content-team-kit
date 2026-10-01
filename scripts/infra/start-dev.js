const { spawn } = require("child_process")
const http = require("http")
const net = require("net")

const NEXT_PORT = 3000
const PROXY_PORT = 5000

let nextReady = false

function proxyRequest(req, res) {
  if (!nextReady) {
    // Retry after short delay until Next.js is ready
    setTimeout(() => proxyRequest(req, res), 200)
    return
  }
  const options = {
    hostname: "127.0.0.1",
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${NEXT_PORT}` },
  }
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  proxyReq.on("error", (err) => {
    res.writeHead(502)
    res.end("Proxy error: " + err.message)
  })
  req.pipe(proxyReq, { end: true })
}

// Start proxy on port 5000 IMMEDIATELY (before Next.js is ready)
const proxy = http.createServer(proxyRequest)
proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Proxy on port ${PROXY_PORT} ready (waiting for Next.js)`)
})

proxy.on("error", (err) => {
  console.error("Proxy error:", err.message)
  process.exit(1)
})

// Handle WebSocket upgrades (for Next.js HMR)
proxy.on("upgrade", (req, socket, head) => {
  if (!nextReady) {
    setTimeout(() => proxy.emit("upgrade", req, socket, head), 200)
    return
  }
  const proxySocket = net.connect(NEXT_PORT, "127.0.0.1", () => {
    proxySocket.write(`${req.method} ${req.url} HTTP/1.1\r\nHost: localhost:${NEXT_PORT}\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`)
    proxySocket.write(head)
    socket.pipe(proxySocket)
    proxySocket.pipe(socket)
  })
  proxySocket.on("error", () => socket.destroy())
  socket.on("error", () => proxySocket.destroy())
})

// Start Next.js on port 3000
const next = spawn("node", ["node_modules/.bin/next", "dev", "-p", String(NEXT_PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env }
})

next.stdout.on("data", (data) => {
  const str = data.toString()
  process.stdout.write(str)
  if (str.includes("Ready") || str.includes("ready")) {
    nextReady = true
    console.log(`Next.js ready — proxy forwarding ${PROXY_PORT} → ${NEXT_PORT}`)
  }
})

next.stderr.on("data", (data) => process.stderr.write(data))
next.on("error", (err) => { console.error("Next.js failed:", err); process.exit(1) })
next.on("exit", (code) => { console.log("Next.js exited:", code); process.exit(code || 0) })

process.on("SIGTERM", () => { next.kill("SIGTERM"); process.exit(0) })
process.on("SIGINT", () => { next.kill("SIGINT"); process.exit(0) })
