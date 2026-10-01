"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { EventoAoVivo } from "@/lib/sala/types"

const BUFFER_MAX = 200
const RECONECTA_MIN_MS = 1000
const RECONECTA_MAX_MS = 10000

// Consome /api/sala/eventos/stream (SSE) com reconexão automática (backoff exponencial
// até 10s), deduplicação por id e buffer de 200. Enquanto pausado, `visiveis` fica
// congelado num snapshot e `novos` conta o que chegou depois; `eventos` (bruto) nunca
// para, então o mapa continua acendendo caixa mesmo com o feed pausado.
export function useSalaEventos() {
  const [eventos, setEventos] = useState<EventoAoVivo[]>([])
  const [pausado, setPausado] = useState(false)
  const [snapshotPausado, setSnapshotPausado] = useState<EventoAoVivo[] | null>(null)

  const idsVistos = useRef<Set<string>>(new Set())
  const esRef = useRef<EventSource | null>(null)
  const backoffRef = useRef(RECONECTA_MIN_MS)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ativoRef = useRef(true)

  const adicionar = useCallback((evt: EventoAoVivo) => {
    if (idsVistos.current.has(evt.id)) return
    idsVistos.current.add(evt.id)
    setEventos((prev) => {
      const proximo = [...prev, evt]
      if (proximo.length > BUFFER_MAX) {
        const removidos = proximo.splice(0, proximo.length - BUFFER_MAX)
        for (const r of removidos) idsVistos.current.delete(r.id)
      }
      return proximo
    })
  }, [])

  const buscarRecentes = useCallback(async () => {
    try {
      const res = await fetch("/api/sala/eventos?limite=50")
      if (!res.ok) return
      const corpo = await res.json()
      const lista = (corpo.eventos ?? []) as EventoAoVivo[]
      lista.forEach(adicionar)
    } catch {
      // sem rede: a próxima tentativa de reconexão do SSE tenta de novo
    }
  }, [adicionar])

  const conectar = useCallback(() => {
    if (!ativoRef.current) return
    const es = new EventSource("/api/sala/eventos/stream")
    esRef.current = es

    es.addEventListener("evento", (ev) => {
      backoffRef.current = RECONECTA_MIN_MS
      try {
        adicionar(JSON.parse((ev as MessageEvent).data) as EventoAoVivo)
      } catch {
        // evento malformado: ignora
      }
    })

    es.onerror = () => {
      es.close()
      if (!ativoRef.current) return
      const espera = backoffRef.current
      backoffRef.current = Math.min(backoffRef.current * 2, RECONECTA_MAX_MS)
      timeoutRef.current = setTimeout(() => {
        buscarRecentes().finally(conectar)
      }, espera)
    }
  }, [adicionar, buscarRecentes])

  useEffect(() => {
    ativoRef.current = true
    conectar()
    return () => {
      ativoRef.current = false
      esRef.current?.close()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pausar = useCallback(() => {
    setSnapshotPausado((atual) => atual ?? eventos)
    setPausado(true)
  }, [eventos])

  const retomar = useCallback(() => {
    setPausado(false)
    setSnapshotPausado(null)
  }, [])

  const visiveis = pausado && snapshotPausado ? snapshotPausado : eventos
  const novos = pausado && snapshotPausado ? eventos.length - snapshotPausado.length : 0

  return {
    eventos,
    visiveis,
    ultimoEvento: eventos.length > 0 ? eventos[eventos.length - 1] : null,
    pausado,
    novos,
    pausar,
    retomar,
  }
}
