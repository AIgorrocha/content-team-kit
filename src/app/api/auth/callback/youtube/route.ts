import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.json(
      { error, description: request.nextUrl.searchParams.get("error_description") },
      { status: 400 }
    )
  }

  if (!code) {
    return NextResponse.json(
      { error: "Código de autorização não recebido" },
      { status: 400 }
    )
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = "http://localhost:5000/api/auth/callback/youtube"

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID ou YOUTUBE_CLIENT_SECRET não configurados" },
      { status: 500 }
    )
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.refresh_token) {
      const maskedRefresh = tokenData.refresh_token.slice(0, 8) + "..." + tokenData.refresh_token.slice(-4)
      const maskedAccess = tokenData.access_token.slice(0, 8) + "..." + tokenData.access_token.slice(-4)

      return new NextResponse(`
        <html>
        <head><meta charset="utf-8"><title>YouTube Conectado</title></head>
        <body style="background:#0D0D0D;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;max-width:600px;">
            <h1 style="color:#FF0000;">YouTube Conectado!</h1>
            <p>Token de refresh gerado com sucesso.</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;text-align:left;">
              <p style="color:#888;font-size:12px;margin-bottom:8px;">REFRESH_TOKEN (parcial): ${maskedRefresh}</p>
              <p style="color:#888;font-size:12px;margin-bottom:0;">ACCESS_TOKEN (parcial): ${maskedAccess}</p>
            </div>
            <p style="color:#FF4444;font-size:14px;">Esta tela NAO guarda os tokens. Para publicar, rode no terminal: node scripts/publishing/youtube-auth.mjs</p>
            <p style="color:#666;font-size:12px;">Com o refresh_token o acesso se renova sozinho enquanto a permissao nao for revogada.</p>
          </div>
        </body>
        </html>
      `, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }

    if (tokenData.access_token && !tokenData.refresh_token) {
      return new NextResponse(`
        <html>
        <head><meta charset="utf-8"><title>YouTube - Sem Refresh Token</title></head>
        <body style="background:#0D0D0D;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;max-width:500px;">
            <h1 style="color:#FFA500;">Atenção</h1>
            <p>Access token recebido, mas sem refresh_token.</p>
            <p style="color:#888;">Isso acontece quando a conta já autorizou antes. Revogue o acesso em <a href="https://myaccount.google.com/permissions" style="color:#4A90D9;">myaccount.google.com/permissions</a> e tente novamente.</p>
          </div>
        </body>
        </html>
      `, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }

    return NextResponse.json(
      { error: "Falha ao obter token" },
      { status: 500 }
    )
  } catch {
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}
