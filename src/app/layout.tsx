import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Content Team AI",
  description: "Dashboard para gerenciamento de 13 agentes de IA de conteudo",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>{children}</body>
    </html>
  )
}
