"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VisaoGeral } from "@/lib/sala/types"

interface RitmoProps {
  semanas: VisaoGeral["ritmo"]
}

// "semana 37 (07 a 11/set)" -> "S37" pro eixo (o rotulo completo fica no tooltip)
function rotuloCurto(semana: string): string {
  const numero = semana.match(/semana (\d+)/)?.[1]
  return numero ? `S${numero}` : semana
}

// Cores só pelos tokens --ct-* (rgb(var(--ct-x)) resolve via CSS custom property,
// inclusive dentro de SVG), então o gráfico acompanha o tema do cliente nos dois
// temas, claro e escuro.
export function Ritmo({ semanas }: RitmoProps) {
  const dados = semanas.map((item) => ({ ...item, rotulo: rotuloCurto(item.semana) }))

  return (
    <Card className="rounded-md xl:col-span-2">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Ritmo das últimas semanas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {semanas.length === 0 ? (
          <p className="text-sm text-text-secondary">Sem histórico de publicação ainda.</p>
        ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ct-border))" />
              <XAxis
                dataKey="rotulo"
                tick={{ fill: "rgb(var(--ct-text-secondary))", fontSize: 12 }}
                axisLine={{ stroke: "rgb(var(--ct-border))" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "rgb(var(--ct-text-secondary))", fontSize: 12 }}
                axisLine={{ stroke: "rgb(var(--ct-border))" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgb(var(--ct-surface-hover))" }}
                contentStyle={{
                  background: "rgb(var(--ct-surface))",
                  border: "1px solid rgb(var(--ct-border))",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "rgb(var(--ct-text-primary))",
                }}
                labelStyle={{ color: "rgb(var(--ct-text-primary))" }}
                itemStyle={{ color: "rgb(var(--ct-text-secondary))" }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.semana ?? ""}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--ct-text-secondary))" }} />
              <Bar dataKey="pecasPublicadas" name="Publicadas" fill="rgb(var(--ct-accent))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pecasTocadas" name="Tocadas" fill="rgb(var(--ct-accent) / 0.35)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  )
}
