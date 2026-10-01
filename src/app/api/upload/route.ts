import { NextRequest, NextResponse } from "next/server"
import { getRequestTenant } from "@/lib/api-auth"
import { validateFileUpload } from "@/lib/integrations/storage"

export async function POST(request: NextRequest) {
  try {
    const tenant = await getRequestTenant(request)
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const validation = validateFileUpload({
      name: file.name,
      size: file.size,
      type: file.type,
    })

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // For now, store file info - actual storage integration depends on tenant's Supabase config
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    }

    return NextResponse.json({ data: fileInfo })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
