import { NextResponse } from "next/server"
import { google } from "googleapis"

export async function GET() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID ou YOUTUBE_CLIENT_SECRET não configurados" },
      { status: 500 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:5000/api/auth/callback/youtube"
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  })

  return NextResponse.redirect(authUrl)
}
