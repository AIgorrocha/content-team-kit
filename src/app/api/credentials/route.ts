import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listCredentialServices, saveCredential } from "@/lib/queries/credentials"
import { z } from "zod"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const services = await listCredentialServices(db)
    return services
  })
}

const saveSchema = z.object({
  service: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
  value: z.string().min(1),
})

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const parsed = saveSchema.parse(body)
    const credential = await saveCredential(db, parsed.service, parsed.key, parsed.value)
    return credential
  })
}
