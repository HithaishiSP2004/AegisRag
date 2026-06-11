import { useState, useEffect, useRef } from 'react'

export function useResizeObserver() {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })

    observer.observe(element)
    return () => {
      observer.unobserve(element)
      observer.disconnect()
    }
  }, [])

  return [ref, dimensions] as const
}
