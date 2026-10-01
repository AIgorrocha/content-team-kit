import type { TenantDB } from "@/lib/tenant-db"
import { getServiceCredentials } from "@/lib/queries/credentials"

interface EmailMessage {
  from: { email: string; name: string }
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlBody?: string
  textBody?: string
}

export async function sendEmail(db: TenantDB, message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const creds = await getServiceCredentials(db, "mailjet")
  const apiKey = creds.api_key
  const secretKey = creds.secret_key

  if (!apiKey || !secretKey) {
    return { success: false, error: "Mailjet não configurado. Vá em Configurações > Integrações." }
  }

  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64")

  const payload = {
    Messages: [
      {
        From: { Email: message.from.email, Name: message.from.name },
        To: message.to.map((t) => ({ Email: t.email, Name: t.name ?? "" })),
        Subject: message.subject,
        HTMLPart: message.htmlBody ?? "",
        TextPart: message.textBody ?? "",
      },
    ],
  }

  try {
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "")
      return { success: false, error: `Mailjet error ${res.status}: ${errorBody}` }
    }

    const data = await res.json()
    const messageId = data?.Messages?.[0]?.To?.[0]?.MessageID
    return { success: true, messageId: String(messageId ?? "") }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao enviar email" }
  }
}
