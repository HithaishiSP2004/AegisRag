'use client'

import { useEffect, useRef, useState } from 'react'

interface Interactive3DLogoProps {
  /** Size of the logo in px */
  size?: number
  /** 'with-name' uses logo-with-name.png, 'icon' uses logo-icon.png */
  variant?: 'icon' | 'with-name'
  /** Extra className */
  className?: string
  /** Whether the parent is in a submitting/loading state — spins logo */
  isSubmitting?: boolean
}

/**
 * Interactive3DLogo
 * -----------------
 * The logo is rendered at a FIXED position but tracks the global mouse cursor.
 * As the cursor moves anywhere on the page the logo tilts towards it in 3D
 * (perspective rotateX / rotateY), creating a true "face-toward-cursor" effect.
 */
export default function Interactive3DLogo({
  size = 88,
  variant = 'icon',
  className = '',
  isSubmitting = false,
}: Interactive3DLogoProps) {
  const logoRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || isSubmitting) return

    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const el = logoRef.current
        if (!el) return

        // Center of the logo in viewport coordinates
        const rect = el.getBoundingClientRect()
        const logoCX = rect.left + rect.width / 2
        const logoCY = rect.top + rect.height / 2

        // Delta from logo center to cursor (px)
        const dx = e.clientX - logoCX
        const dy = e.clientY - logoCY

        // Clamp the rotation so it never goes past ±30deg
        const maxRot = 30
        // Use screen diagonal as normalizer so the effect is consistent
        const diagLen = Math.hypot(window.innerWidth, window.innerHeight)
        const rotY = Math.max(-maxRot, Math.min(maxRot, (dx / diagLen) * 90))
        const rotX = Math.max(-maxRot, Math.min(maxRot, (-dy / diagLen) * 90))

        el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04, 1.04, 1.04)`
        el.style.filter = `drop-shadow(0 12px 28px rgba(0, 0, 0, 0.6)) drop-shadow(0 4px 12px rgba(99, 102, 241, 0.12))`
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mounted, isSubmitting])

  // On submit — spin the logo
  const spinStyle: React.CSSProperties = isSubmitting
    ? { animation: 'logo3d-spinY 1.6s linear infinite' }
    : {}

  const src = variant === 'with-name' ? '/logo-with-name.png' : '/logo-icon.png'

  return (
    <>
      <div
        ref={logoRef}
        className={`interactive-3d-logo ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          transformStyle: 'preserve-3d',
          transition: isSubmitting
            ? 'none'
            : 'transform 0.18s cubic-bezier(0.25, 1, 0.5, 1), filter 0.18s ease',
          filter: 'drop-shadow(0 12px 28px rgba(0, 0, 0, 0.6)) drop-shadow(0 4px 12px rgba(99, 102, 241, 0.12))',
          willChange: 'transform, filter',
          ...spinStyle,
        }}
      >
        <img
          src={src}
          alt="AegisRAG Logo"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
          draggable={false}
        />
      </div>

      <style jsx>{`
        @keyframes logo3d-float {
          0%, 100% { margin-top: 0px; }
          50%       { margin-top: -6px; }
        }
        @keyframes logo3d-spinY {
          from { transform: perspective(900px) rotateY(0deg); }
          to   { transform: perspective(900px) rotateY(360deg); }
        }
      `}</style>
    </>
  )
}
