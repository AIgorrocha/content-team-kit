import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.json({ error, description: request.nextUrl.searchParams.get("error_description") }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: "Código de autorização não recebido" }, { status: 400 })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const isLocal = request.nextUrl.hostname === "localhost"
  const redirectUri = isLocal
    ? "http://localhost:5000/api/auth/callback/linkedin"
    : `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/auth/callback/linkedin`

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId ?? "",
        client_secret: clientSecret ?? "",
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.access_token) {
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const profile = await profileRes.json()

      const safeName = (profile.name ?? profile.sub ?? "").replace(/[<>"'&]/g, "")
      const expiryDays = tokenData.expires_in ? Math.round(tokenData.expires_in / 86400) : "?"
      const maskedToken = tokenData.access_token.slice(0, 8) + "..." + tokenData.access_token.slice(-4)

      return new NextResponse(`
        <html>
        <head><meta charset="utf-8"><title>LinkedIn Conectado</title></head>
        <body style="background:#0D0D0D;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;max-width:500px;">
            <h1 style="color:#4A90D9;">LinkedIn Conectado!</h1>
            <p>Perfil: <strong>${safeName}</strong></p>
            <p>Token gerado com sucesso (expira em ${expiryDays} dias)</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;text-align:left;">
              <p style="color:#888;font-size:12px;margin-bottom:8px;">Token (parcial): ${maskedToken}</p>
            </div>
            <p style="color:#4A90D9;font-size:14px;">Esta tela NAO guarda o token. Para publicar, rode no terminal: node scripts/publishing/linkedin-auth-local.mjs</p>
          </div>
        </body>
        </html>
      `, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }

    return NextResponse.json({ error: "Falha ao obter token" }, { status: 500 })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
