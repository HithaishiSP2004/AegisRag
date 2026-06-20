'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  ShieldAlert,
  Scale,
  BarChart3,
  Shield,
  Activity,
} from 'lucide-react'
import { colors, font, radius, transition } from '@/components/ui/tokens'

interface WorkspaceNode {
  id: string
  label: string
  descriptor: string
  bullets: string[]
  route: string
  icon: React.ReactNode
  side: 'left' | 'right'
}

export default function CommandHubPage() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [coordinates, setCoordinates] = useState<Record<string, { x: number; y: number }>>({})
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  
  const hoveredNodeRef = useRef<string | null>(null)
  const coordinatesRef = useRef<Record<string, { x: number; y: number }>>({})

  // Sync refs so canvas loop always has access to latest react state
  useEffect(() => {
    hoveredNodeRef.current = hoveredNode
  }, [hoveredNode])

  useEffect(() => {
    coordinatesRef.current = coordinates
  }, [coordinates])

  const WORKSPACES: WorkspaceNode[] = [
    {
      id: 'mission-control',
      label: 'Mission Control',
      descriptor: 'Strategic Oversight',
      bullets: ['Risk Monitoring', 'Compliance Tracking', 'Threat Response', 'Executive Visibility'],
      route: '/dashboard',
      icon: <LayoutDashboard size={18} />,
      side: 'left'
    },
    {
      id: 'workbench',
      label: 'Knowledge Workbench',
      descriptor: 'Retrieval Intelligence',
      bullets: ['RAG Testing', 'Prompt Evaluation', 'Citation Validation', 'Groundedness Analysis'],
      route: '/chat',
      icon: <MessageSquare size={18} />,
      side: 'left'
    },
    {
      id: 'workflows',
      label: 'Compliance Workflows',
      descriptor: 'Governance Operations',
      bullets: ['Workflow Templates', 'Multi-model Runs', 'Execution Auditing', 'Resilience Pipeline'],
      route: '/workflows',
      icon: <Activity size={18} />,
      side: 'left'
    },
    {
      id: 'vault',
      label: 'Knowledge Vault',
      descriptor: 'Knowledge Infrastructure',
      bullets: ['Vector DB Status', 'Parser Pipelines', 'Ingestion Feeds', 'Metadata Schemas'],
      route: '/knowledge-vault',
      icon: <Database size={18} />,
      side: 'left'
    },
    {
      id: 'security',
      label: 'Security Center',
      descriptor: 'Threat Intelligence',
      bullets: ['Prompt Injections', 'Jailbreak Detections', 'User Violations', 'Rate Limits'],
      route: '/dashboard/security',
      icon: <ShieldAlert size={18} />,
      side: 'right'
    },
    {
      id: 'compliance',
      label: 'Compliance Studio',
      descriptor: 'Governance Operations',
      bullets: ['Audit Readiness', 'SOC2 Controls', 'Review Cycles', 'Policy Mapping'],
      route: '/dashboard/compliance',
      icon: <Scale size={18} />,
      side: 'right'
    },
    {
      id: 'reports',
      label: 'Analytics & Reports',
      descriptor: 'Operational Analytics',
      bullets: ['Audit Logs', 'Latency Tracking', 'Token Usages', 'Cost Allocations'],
      route: '/dashboard/reports',
      icon: <BarChart3 size={18} />,
      side: 'right'
    }
  ]

  // Node Mesh Background Animation with Telemetry Sweeps
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      label?: string
    }> = []

    // Add normal drift particles
    const particleCount = 35
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.2 + 0.4,
      })
    }

    // Add special telemetry coordinate labels
    const telemetryLabels = ['CORE_SYS_A', 'NODE_LINK_OK', 'LAT_12.8MS', 'SECURE_TUNNEL', 'DB_SYNC', 'AZ_982', 'SYS_VAL_04', 'AUTH_VALID']
    telemetryLabels.forEach((label) => {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        radius: 0.8,
        label
      })
    })

    // Telemetry scanner line Y position
    let scannerY = 0
    let scannerDir = 1

    function animate() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      // Draw faint tactical grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.008)'
      ctx.lineWidth = 0.5
      const gridSize = 80
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw horizontal scanner line sweep
      scannerY += 0.5 * scannerDir
      if (scannerY > height || scannerY < 0) {
        scannerDir *= -1
      }
      ctx.beginPath()
      ctx.moveTo(0, scannerY)
      ctx.lineTo(width, scannerY)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.025)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Draw node target HUD overlay on canvas
      const activeId = hoveredNodeRef.current
      if (activeId) {
        const coord = coordinatesRef.current[activeId]
        if (coord) {
          // Draw target circle
          ctx.beginPath()
          ctx.arc(coord.x, coord.y, 28, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)'
          ctx.lineWidth = 0.8
          ctx.stroke()

          // Draw dotted target circle
          ctx.beginPath()
          ctx.arc(coord.x, coord.y, 38, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)'
          ctx.setLineDash([2, 4])
          ctx.stroke()
          ctx.setLineDash([])

          // Draw target crosshairs
          ctx.beginPath()
          ctx.moveTo(coord.x - 45, coord.y)
          ctx.lineTo(coord.x + 45, coord.y)
          ctx.moveTo(coord.x, coord.y - 45)
          ctx.lineTo(coord.x, coord.y + 45)
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)'
          ctx.stroke()

          // Text tag next to hovered target node
          ctx.fillStyle = 'rgba(99, 102, 241, 0.6)'
          ctx.font = '8px monospace'
          ctx.fillText(`TARGET_LOCK: ${activeId.toUpperCase()}`, coord.x + 42, coord.y - 12)
          ctx.fillText(`[VAL_ERR_00]`, coord.x + 42, coord.y + 16)
        }
      }

      // Draw particles & labels
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.label ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)'
        ctx.fill()

        if (p.label) {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'
          ctx.font = '7.5px monospace'
          ctx.fillText(p.label, p.x + 6, p.y + 3)
        }
      })

      // Connect close nodes (ambient mesh lines)
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
          if (dist < 140) {
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.05 * (1 - dist / 140)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    function handleResize() {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Calculate coordinates for dynamic SVG connection lines
  useEffect(() => {
    function updateCoords() {
      if (!coreRef.current) return
      const coreRect = coreRef.current.getBoundingClientRect()
      const parentRect = coreRef.current.parentElement?.getBoundingClientRect() || { left: 0, top: 0 }

      const newCoords: Record<string, { x: number; y: number }> = {}
      const coreX = coreRect.left + coreRect.width / 2 - parentRect.left
      const coreY = coreRect.top + coreRect.height / 2 - parentRect.top
      newCoords['core'] = { x: coreX, y: coreY }

      WORKSPACES.forEach((ws) => {
        const el = nodeRefs.current[ws.id]
        if (!el) return
        const elRect = el.getBoundingClientRect()
        const elX = (ws.side === 'left' ? elRect.right : elRect.left) - parentRect.left
        const elY = elRect.top + elRect.height / 2 - parentRect.top
        newCoords[ws.id] = { x: elX, y: elY }
      })

      setCoordinates(newCoords)
    }

    const timer = setTimeout(updateCoords, 100)
    window.addEventListener('resize', updateCoords)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateCoords)
    }
  }, [])

  const activeWorkspace = WORKSPACES.find((ws) => ws.id === hoveredNode)

  const labelHighlights: Record<string, string> = {
    'mission-control': 'RISK',
    'workbench': 'GROUNDEDNESS',
    'workflows': 'COMPLIANCE',
    'vault': 'INFRASTRUCTURE',
    'security': 'RISK',
    'compliance': 'COMPLIANCE',
    'reports': 'INFRASTRUCTURE',
  }
  const activeHighlight = hoveredNode ? labelHighlights[hoveredNode] : null

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030508', // Cinematic palantir-black background
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: font.sans,
        color: colors.textPrimary,
      }}
    >
      {/* Background Canvas for Animated Telemetry Mesh */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Strategic Radial Vignette Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(3, 5, 8, 0.95) 90%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* TOP BAR */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          height: '56px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          background: 'rgba(3, 5, 8, 0.75)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Link
          href="/command-hub"
          className="aegis-logo-link"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <img
            src="/logo-icon.png"
            alt="AegisRAG Logo"
            className="logo-img"
            style={{
              width: '24px',
              height: '24px',
              objectFit: 'contain',
              userSelect: 'none',
              transition: 'transform 0.3s ease, filter 0.3s ease',
            }}
            draggable={false}
          />
          <div>
            <span
              className="logo-text"
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                fontFamily: font.mono,
                background: 'linear-gradient(135deg, #22D3EE 0%, #6366F1 50%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
                display: 'inline-block',
                transition: 'filter 0.3s ease',
              }}
            >
              AEGISRAG
            </span>
            <span style={{ color: colors.textMuted, fontSize: '8.5px', marginLeft: '12px', letterSpacing: '0.04em', fontFamily: font.mono }}>
              SYS_VERSION: 1.0.4-BETA
            </span>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: colors.emerald, fontFamily: font.mono, letterSpacing: '0.04em' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.emerald }} />
            SYS_SECURE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: colors.sky, fontFamily: font.mono, letterSpacing: '0.04em' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.sky }} />
            NODE_LINKED
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: colors.indigoLight, fontFamily: font.mono, letterSpacing: '0.04em' }}>
            <span className="animate-pulse-slow" style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.indigoLight }} />
            TELEMETRY_ON
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <section
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 72px',
          zIndex: 5,
        }}
      >
        {/* SVG Conduit Paths Overlay */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {coordinates['core'] &&
            WORKSPACES.map((ws) => {
              const start = coordinates[ws.id]
              const end = coordinates['core']
              if (!start || !end) return null

              const isHovered = hoveredNode === ws.id

              const dx = end.x - start.x
              const controlX = start.x + dx * 0.5
              const pathD = `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`

              return (
                <g key={ws.id}>
                  {/* Faint network conduit */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isHovered ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.02)'}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
                  />
                  {/* Pulsing telemetry sweep indicator */}
                  {isHovered && (
                    <path
                      className="animate-conduit-flow"
                      d={pathD}
                      fill="none"
                      stroke={colors.indigoLight}
                      strokeWidth={1.5}
                      strokeDasharray="6 12"
                      strokeDashoffset={100}
                    />
                  )}
                </g>
              )
            })}
        </svg>

        {/* LEFT COLUMN: Workspace Portal Nodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '44px', width: '280px', zIndex: 4 }}>
          {WORKSPACES.filter((ws) => ws.side === 'left').map((ws) => {
            const isHovered = hoveredNode === ws.id
            return (
              <div
                key={ws.id}
                ref={(el) => {
                  nodeRefs.current[ws.id] = el
                }}
                onMouseEnter={() => setHoveredNode(ws.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ position: 'relative' }}
              >
                <Link
                  href={ws.route}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    background: isHovered ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.015)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: colors.textPrimary,
                    transition: transition.base,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {/* Visual Tactical Corner HUD Brackets */}
                  {isHovered && (
                    <>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '4px', borderTop: `1.5px solid ${colors.indigoLight}`, borderLeft: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '4px', borderTop: `1.5px solid ${colors.indigoLight}`, borderRight: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '4px', height: '4px', borderBottom: `1.5px solid ${colors.indigoLight}`, borderLeft: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '4px', height: '4px', borderBottom: `1.5px solid ${colors.indigoLight}`, borderRight: `1.5px solid ${colors.indigoLight}` }} />
                    </>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      background: isHovered ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      color: isHovered ? colors.indigoLight : colors.textMuted,
                      border: `1px solid ${isHovered ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)'}`,
                      transition: transition.base,
                    }}
                  >
                    {ws.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.08em', fontFamily: font.mono }}>
                        {ws.label.toUpperCase()}
                      </h3>
                      {isHovered && (
                        <span style={{ fontSize: '7px', color: colors.indigoLight, fontFamily: font.mono, opacity: 0.8 }}>
                          [ LINK_OK ]
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '8.5px', color: colors.textMuted, marginTop: '2px', fontFamily: font.mono }}>
                      {ws.descriptor.toUpperCase()}
                    </p>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>

        {/* CENTER AEGIS CORE HUD - 35% Larger Visual Dominance */}
        <div
          ref={coreRef}
          style={{
            position: 'relative',
            width: '560px',
            height: '560px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
          }}
        >
          {/* Pulsing Cinematic Ambient Glow Aura behind Core */}
          <div
            className="animate-pulse-glow"
            style={{
              position: 'absolute',
              width: '460px',
              height: '460px',
              borderRadius: '50%',
              background: hoveredNode
                ? 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)',
              transition: 'background 0.5s ease',
              pointerEvents: 'none',
              filter: 'blur(28px)',
            }}
          />

          {/* SVG Concentric HUD Rings & Telemetry Compass */}
          <svg
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Outer Slow Dotted Dial Ring (Radius 250) */}
            <circle
              cx="280"
              cy="280"
              r="250"
              fill="none"
              stroke="rgba(255, 255, 255, 0.02)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              className="animate-spin-slow"
              style={{ transformOrigin: '280px 280px' }}
            />

            {/* Middle Rotating Segment Ring (Radius 240) */}
            <circle
              cx="280"
              cy="280"
              r="240"
              fill="none"
              stroke="rgba(255, 255, 255, 0.015)"
              strokeWidth="1.2"
              strokeDasharray="40 15"
              className="animate-spin-reverse-slow"
              style={{ transformOrigin: '280px 280px' }}
            />

            {/* Sweep radar arm line */}
            <line
              x1="280"
              y1="280"
              x2="280"
              y2="45"
              stroke="rgba(6, 182, 212, 0.06)"
              strokeWidth="1.5"
              className="animate-telemetry-sweep"
              style={{ transformOrigin: '280px 280px' }}
            />

            {/* Cardinal Telemetry Labels */}
            {/* RISK Label (Top) */}
            <circle
              cx="280"
              cy="100"
              r="2.5"
              fill={activeHighlight === 'RISK' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}
              style={{ transition: 'fill 0.3s' }}
            />
            <text
              x="280"
              y="90"
              textAnchor="middle"
              fill={activeHighlight === 'RISK' ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)'}
              style={{
                fontSize: '8px',
                fontFamily: font.mono,
                letterSpacing: '0.12em',
                transition: 'fill 0.3s',
                fontWeight: activeHighlight === 'RISK' ? 800 : 400,
              }}
            >
              RISK
            </text>

            {/* COMPLIANCE Label (Right) */}
            <circle
              cx="460"
              cy="280"
              r="2.5"
              fill={activeHighlight === 'COMPLIANCE' ? '#22d3ee' : 'rgba(255, 255, 255, 0.1)'}
              style={{ transition: 'fill 0.3s' }}
            />
            <text
              x="472"
              y="283"
              textAnchor="start"
              fill={activeHighlight === 'COMPLIANCE' ? '#22d3ee' : 'rgba(255, 255, 255, 0.15)'}
              style={{
                fontSize: '8px',
                fontFamily: font.mono,
                letterSpacing: '0.12em',
                transition: 'fill 0.3s',
                fontWeight: activeHighlight === 'COMPLIANCE' ? 800 : 400,
              }}
            >
              COMPLIANCE
            </text>

            {/* GROUNDEDNESS Label (Left) */}
            <circle
              cx="100"
              cy="280"
              r="2.5"
              fill={activeHighlight === 'GROUNDEDNESS' ? '#22d3ee' : 'rgba(255, 255, 255, 0.1)'}
              style={{ transition: 'fill 0.3s' }}
            />
            <text
              x="88"
              y="283"
              textAnchor="end"
              fill={activeHighlight === 'GROUNDEDNESS' ? '#22d3ee' : 'rgba(255, 255, 255, 0.15)'}
              style={{
                fontSize: '8px',
                fontFamily: font.mono,
                letterSpacing: '0.12em',
                transition: 'fill 0.3s',
                fontWeight: activeHighlight === 'GROUNDEDNESS' ? 800 : 400,
              }}
            >
              GROUNDEDNESS
            </text>

            {/* INFRASTRUCTURE Label (Bottom) */}
            <circle
              cx="280"
              cy="460"
              r="2.5"
              fill={activeHighlight === 'INFRASTRUCTURE' ? '#818cf8' : 'rgba(255, 255, 255, 0.1)'}
              style={{ transition: 'fill 0.3s' }}
            />
            <text
              x="280"
              y="475"
              textAnchor="middle"
              fill={activeHighlight === 'INFRASTRUCTURE' ? '#818cf8' : 'rgba(255, 255, 255, 0.15)'}
              style={{
                fontSize: '8px',
                fontFamily: font.mono,
                letterSpacing: '0.12em',
                transition: 'fill 0.3s',
                fontWeight: activeHighlight === 'INFRASTRUCTURE' ? 800 : 400,
              }}
            >
              INFRASTRUCTURE
            </text>

            {/* Concentric rings mapped back to standard transform orientation */}
            <g transform="rotate(-90 280 280)">
              {/* Secondary Telemetry Orbit (Radius 195) */}
              <circle
                cx="280"
                cy="280"
                r="195"
                fill="none"
                stroke="rgba(6, 182, 212, 0.05)"
                strokeWidth="1"
                strokeDasharray="4 8"
              />

              {/* Tertiary Telemetry Orbit (Radius 220) */}
              <circle
                cx="280"
                cy="280"
                r="220"
                fill="none"
                stroke="rgba(255, 255, 255, 0.02)"
                strokeWidth="1"
                strokeDasharray="1 12"
              />

              {/* Ring 1: Primary Information Ring (Radius 160) - Base Path */}
              <circle
                cx="280"
                cy="280"
                r="160"
                fill="none"
                stroke="rgba(255, 255, 255, 0.02)"
                strokeWidth="4"
              />

              {/* Segment 1: Groundedness (Muted Violet) */}
              <circle
                cx="280"
                cy="280"
                r="160"
                fill="none"
                stroke="#818cf8"
                strokeWidth="4"
                strokeDasharray="1005"
                strokeDashoffset={1005 * (1 - 0.30)}
                style={{
                  strokeLinecap: 'butt',
                  opacity: activeHighlight === 'GROUNDEDNESS' ? 1.0 : 0.45,
                  transition: 'opacity 0.3s, stroke-width 0.3s',
                }}
              />

              {/* Segment 2: Compliance (Aegis Cyan) */}
              <circle
                cx="280"
                cy="280"
                r="160"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="4"
                strokeDasharray="1005"
                strokeDashoffset={1005 * (1 - 0.55)}
                transform="rotate(120 280 280)"
                style={{
                  strokeLinecap: 'butt',
                  opacity: activeHighlight === 'COMPLIANCE' || activeHighlight === 'INFRASTRUCTURE' ? 1.0 : 0.45,
                  transition: 'opacity 0.3s, stroke-width 0.3s',
                }}
              />

              {/* Segment 3: Alert (Amber) */}
              <circle
                cx="280"
                cy="280"
                r="160"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray="1005"
                strokeDashoffset={1005 * (1 - 0.08)}
                transform="rotate(310 280 280)"
                style={{
                  strokeLinecap: 'butt',
                  opacity: activeHighlight === 'RISK' ? 1.0 : 0.15,
                  transition: 'opacity 0.3s, stroke-width 0.3s',
                }}
              />
            </g>
          </svg>

          {/* Central Contextual Readout Panel */}
          <div
            style={{
              position: 'absolute',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              background: 'rgba(3, 5, 8, 0.96)',
              border: '1.5px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.14), inset 0 0 24px rgba(6, 182, 212, 0.08)',
              backdropFilter: 'blur(20px)',
              zIndex: 5,
            }}
          >
            {activeWorkspace ? (
              /* Hovered workspace contextual preview state */
              <div
                className="animate-fade-in-quick"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '8px', fontWeight: 900, color: '#818cf8', letterSpacing: '0.12em', fontFamily: font.mono }}>
                  PREVIEW LOCK
                </span>
                <h2 style={{ fontSize: '13px', fontWeight: 800, color: colors.textPrimary, marginTop: '8px', fontFamily: font.mono, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {activeWorkspace.label}
                </h2>
                <div style={{ width: '40px', height: '1px', background: 'rgba(6, 182, 212, 0.3)', margin: '12px 0' }} />
                
                {/* Technical tactical sub-features list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  {activeWorkspace.bullets.map((bullet, idx) => (
                    <span key={idx} style={{ fontSize: '8.5px', color: colors.textSecondary, fontFamily: font.mono, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      :: {bullet}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              /* Global Core status default view */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '8.5px', fontWeight: 900, color: '#818cf8', letterSpacing: '0.14em', fontFamily: font.mono }}>
                  AEGIS CORE
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '0.04em', color: colors.textPrimary, margin: '6px 0', fontFamily: font.mono }}>
                  ONLINE
                </span>
                <span style={{ fontSize: '8.5px', color: '#22d3ee', fontWeight: 700, letterSpacing: '0.08em', fontFamily: font.mono }}>
                  INTEGRITY_STABLE
                </span>
                <div style={{ width: '50px', height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '14px 0' }} />
                <span style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  SELECT NODE TO ENGAGE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Workspace Portal Nodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '44px', width: '280px', zIndex: 4 }}>
          {WORKSPACES.filter((ws) => ws.side === 'right').map((ws) => {
            const isHovered = hoveredNode === ws.id
            return (
              <div
                key={ws.id}
                ref={(el) => {
                  nodeRefs.current[ws.id] = el
                }}
                onMouseEnter={() => setHoveredNode(ws.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ position: 'relative' }}
              >
                <Link
                  href={ws.route}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    background: isHovered ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.015)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: colors.textPrimary,
                    transition: transition.base,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {/* Visual Tactical Corner HUD Brackets */}
                  {isHovered && (
                    <>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '4px', borderTop: `1.5px solid ${colors.indigoLight}`, borderLeft: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '4px', borderTop: `1.5px solid ${colors.indigoLight}`, borderRight: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '4px', height: '4px', borderBottom: `1.5px solid ${colors.indigoLight}`, borderLeft: `1.5px solid ${colors.indigoLight}` }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '4px', height: '4px', borderBottom: `1.5px solid ${colors.indigoLight}`, borderRight: `1.5px solid ${colors.indigoLight}` }} />
                    </>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      background: isHovered ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      color: isHovered ? colors.indigoLight : colors.textMuted,
                      border: `1px solid ${isHovered ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)'}`,
                      transition: transition.base,
                    }}
                  >
                    {ws.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.08em', fontFamily: font.mono }}>
                        {ws.label.toUpperCase()}
                      </h3>
                      {isHovered && (
                        <span style={{ fontSize: '7px', color: colors.indigoLight, fontFamily: font.mono, opacity: 0.8 }}>
                          [ LINK_OK ]
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '8.5px', color: colors.textMuted, marginTop: '2px', fontFamily: font.mono }}>
                      {ws.descriptor.toUpperCase()}
                    </p>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* BOTTOM SECTION: INTELLIGENCE BRIEFING */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          background: 'rgba(3, 5, 8, 0.85)',
          backdropFilter: 'blur(16px)',
          padding: '14px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={12} style={{ color: colors.indigoLight }} />
          <span style={{ fontSize: '8.5px', fontWeight: 900, color: colors.indigoLight, letterSpacing: '0.12em', fontFamily: font.mono }}>
            INTELLIGENCE BRIEFING
          </span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px' }}>
          {/* Briefing 1: Security */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '8px', fontWeight: 900, padding: '1px 5px', background: 'rgba(244,63,94,0.08)', color: colors.rose, border: '1px solid rgba(244,63,94,0.15)', borderRadius: '2px', fontFamily: font.mono }}>
              SEC
            </span>
            <span style={{ fontSize: '9px', color: colors.textSecondary, fontFamily: font.mono, letterSpacing: '0.02em' }}>
              0 ACTIVE THREATS DETECTED IN LAST 24H
            </span>
          </div>

          {/* Briefing 2: Neural Groundedness */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '8px', fontWeight: 900, padding: '1px 5px', background: 'rgba(99,102,241,0.08)', color: colors.indigoLight, border: '1px solid rgba(99,102,241,0.15)', borderRadius: '2px', fontFamily: font.mono }}>
              NEURAL
            </span>
            <span style={{ fontSize: '9px', color: colors.textSecondary, fontFamily: font.mono, letterSpacing: '0.02em' }}>
              GROUNDEDNESS EVALUATION STABLE AT 91%
            </span>
          </div>

          {/* Briefing 3: Compliance */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '8px', fontWeight: 900, padding: '1px 5px', background: 'rgba(16,185,129,0.08)', color: colors.emerald, border: '1px solid rgba(16,185,129,0.15)', borderRadius: '2px', fontFamily: font.mono }}>
              COMP
            </span>
            <span style={{ fontSize: '9px', color: colors.textSecondary, fontFamily: font.mono, letterSpacing: '0.02em' }}>
              SOC2 CONTROL TELEMETRY FULLY SYNCHRONIZED
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
}
