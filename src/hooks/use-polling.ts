"use client"

import { useState, useEffect, useCallback } from "react"

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  interval?: number
  enabled?: boolean
}

interface UsePollingResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
}

export function usePolling<T>({
  fetcher,
  interval = 30000,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    if (!enabled) return

    refresh()

    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [refresh, interval, enabled])

  return { data, error, loading, refresh }
}
