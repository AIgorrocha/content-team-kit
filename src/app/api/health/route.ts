import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const result = await query<{ now: string }>("SELECT NOW() as now")
    const tables = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name LIKE 'ct_%'"
    )

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: result[0]?.now,
      ct_tables: parseInt(tables[0]?.count ?? "0"),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
