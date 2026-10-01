import { SalaNav } from "@/components/sala/SalaNav"
import { SalaTema } from "@/components/sala/SalaTema"

// O cliente vem do cookie e os dados devem ser lidos a cada requisição.
export const dynamic = "force-dynamic"

export default function SalaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-sala>
      <SalaTema />
      <SalaNav />
      {children}
    </div>
  )
}
