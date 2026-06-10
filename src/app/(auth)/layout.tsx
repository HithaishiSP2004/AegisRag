'use client'

import { Suspense, useEffect, useRef } from 'react'
import AuthLeftPane from './AuthLeftPane'

function BackgroundGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // 1. Starfield particles (Background layer)
    const starCount = 45
    const stars: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      baseOpacity: number
      twinkleSpeed: number
      phase: number
    }> = []

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        radius: Math.random() * 1.5 + 0.5,
        baseOpacity: Math.random() * 0.25 + 0.1,
        twinkleSpeed: Math.random() * 0.8 + 0.4,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // 2. Security Network nodes (Foreground layer)
    const nodeCount = 28
    const nodes: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
    }> = []

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: Math.random() * 2 + 1.5,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      const time = Date.now() * 0.001

      // Draw Starfield (twinkling slow background particles)
      for (let i = 0; i < starCount; i++) {
        const s = stars[i]
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * s.twinkleSpeed + s.phase))
        ctx.fillStyle = `rgba(147, 197, 253, ${s.baseOpacity * twinkle})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx.fill()

        s.x += s.vx
        s.y += s.vy

        // Wrap-around
        if (s.x < 0) s.x = width
        if (s.x > width) s.x = 0
        if (s.y < 0) s.y = height
        if (s.y > height) s.y = 0
      }

      // Draw Connections & Governance Data Flows
      ctx.lineWidth = 0.6
      for (let i = 0; i < nodeCount; i++) {
        const n1 = nodes[i]
        for (let j = i + 1; j < nodeCount; j++) {
          const n2 = nodes[j]
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y)
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.12
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(n1.x, n1.y)
            ctx.lineTo(n2.x, n2.y)
            ctx.stroke()

            // Draw traveling data packet
            const progress = (time * 0.35 + (i + j) * 0.17) % 1
            const px = n1.x + (n2.x - n1.x) * progress
            const py = n1.y + (n2.y - n1.y) * progress

            ctx.fillStyle = `rgba(147, 197, 253, ${alpha * 3})`
            ctx.beginPath()
            ctx.arc(px, py, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Draw Network Nodes
      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i]
        ctx.shadowBlur = 4
        ctx.shadowColor = 'rgba(59, 130, 246, 0.3)'
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fill()

        n.x += n.vx
        n.y += n.vy

        // Wrap-around
        if (n.x < 0) n.x = width
        if (n.x > width) n.x = 0
        if (n.y < 0) n.y = height
        if (n.y > height) n.y = 0
      }

      ctx.shadowBlur = 0
      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.9,
      }}
    />
  )
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="auth-layout-container"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#030712',
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.04), transparent 50%),
          radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.03), transparent 50%)
        `,
        overflow: 'hidden',
        color: '#F8FAFC',
        fontFamily: 'var(--font-inter), sans-serif',
        position: 'relative',
      }}
    >
      {/* Background Interactive Graph */}
      <BackgroundGraph />

      {/* Visual Attestation Panel (Left Side: 60%) */}
      <div
        className="auth-sidebar"
        style={{
          display: 'flex',
          flex: 6,
          order: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <AuthLeftPane />
      </div>

      {/* Main Interactive Auth Card Panel (Right Side: 40%) */}
      <div
        className="auth-card-container"
        style={{
          flex: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '48px 32px',
          position: 'relative',
          overflowY: 'auto',
          height: '100vh',
          order: 2,
          zIndex: 1,
        }}
      >
        {/* Subtle grid pattern overlay for right side */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
          }}
        />

        {/* Scroll Safety Flex Wrapper */}
        <div
          className="scroll-wrapper"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: '100%',
            width: '100%',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Decorative glowing blob behind the card for visual depth and premium feel */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '480px',
              height: '480px',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.04) 50%, transparent 70%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Enterprise Glassmorphism Auth Card Container (480px width) */}
          <div
            className="auth-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              position: 'relative',
              zIndex: 5,
            }}
          >
            <Suspense
              fallback={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#64748B', fontSize: '0.82rem' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#38BDF8', animation: 'spin 1s linear infinite' }} />
                  <span>Synchronizing security context...</span>
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </div>

      {/* Responsive Styles CSS */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Centering container for layout spacing */
        .scroll-wrapper {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          min-height: 100% !important;
          width: 100% !important;
          position: relative !important;
          z-index: 2 !important;
          padding: 0 !important;
        }

        .scroll-wrapper::before,
        .scroll-wrapper::after {
          content: '' !important;
          display: block !important;
          flex: 1 1 auto !important;
          min-height: 32px !important;
        }
        
        /* Premium Glassmorphic Auth Card */
        .auth-card {
          background: rgba(11, 17, 32, 0.92) !important;
          backdrop-filter: blur(24px) !important;
          -webkit-backdrop-filter: blur(24px) !important;
          border: 1px solid rgba(59, 130, 246, 0.25) !important;
          border-radius: 12px !important;
          padding: 36px 32px !important;
          margin: 0 !important; /* Springs handle centering */
          flex-shrink: 0 !important;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 50px rgba(59, 130, 246, 0.08) !important;
          transition: transform 0.3s ease, box-shadow 0.3s ease !important;
          animation: float-card 8s ease-in-out infinite;
        }

        @keyframes float-card {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }

        /* Height-based adjustments for short viewports */
        @media (max-height: 720px) {
          .auth-card-container {
            padding: 16px !important;
          }
          .scroll-wrapper::before,
          .scroll-wrapper::after {
            min-height: 12px !important;
          }
          .auth-card {
            margin: 0 !important;
            padding: 24px 20px !important;
            animation: none !important; /* Stop float animation on short screens for stability */
          }
        }

        @media (max-width: 1024px) {
          /* Hide the feature sidebar completely on mobile/tablet to eliminate leakage */
          .auth-sidebar {
            display: none !important;
          }
          /* Ensure card container fills screen and is fully scrollable */
          .auth-card-container {
            flex: 1 !important;
            width: 100% !important;
            padding: 16px 12px !important;
            height: 100vh !important;
            overflow-y: auto !important;
          }
          .scroll-wrapper::before,
          .scroll-wrapper::after {
            min-height: 16px !important;
          }
          .auth-card {
            margin: 0 !important;
            animation: none !important;
            padding: 32px 24px !important;
          }
        }

        @media (max-width: 480px) {
          .scroll-wrapper::before,
          .scroll-wrapper::after {
            min-height: 8px !important;
          }
          .auth-card {
            margin: 0 !important;
            padding: 24px 16px !important;
            border-radius: 8px !important;
          }
        }
      `}</style>
    </div>
  )
}
