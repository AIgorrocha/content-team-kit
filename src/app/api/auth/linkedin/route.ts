import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID não configurado" },
      { status: 500 }
    )
  }

  const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/auth/callback/linkedin`

  const scopes = [
    "openid",
    "profile",
    "w_member_social",
    "r_basicprofile",
    "r_organization_social",
    "w_organization_social",
  ].join(" ")

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`

  return NextResponse.redirect(authUrl)
}
