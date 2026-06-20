import { useState, useLayoutEffect, useRef } from 'react'

export function useResizeObserver(defaultWidth = 500, defaultHeight = 240) {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: defaultWidth, height: defaultHeight })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    // Read initial size immediately — avoids "Recalculating layout..." flash
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height })
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return
      const { width: w, height: h } = entries[0].contentRect
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h })
      }
    })

    observer.observe(element)
    return () => {
      observer.unobserve(element)
      observer.disconnect()
    }
  }, [])

  return [ref, dimensions] as const
}
