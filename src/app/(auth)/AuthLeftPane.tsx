'use client'

import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'

const nodes = [
  { id: 1, label: 'Data Sources', icon: 'solar:document-bold', color: '#3B82F6' },
  { id: 2, label: 'Retrieval Engine', icon: 'solar:database-bold', color: '#3B82F6' },
  { id: 3, label: 'Policy Validation', icon: 'solar:shield-keyhole-bold', color: '#F59E0B' },
  { id: 4, label: 'Compliance Verification', icon: 'solar:clipboard-check-bold', color: '#8B5CF6' },
  { id: 5, label: 'Model Execution', icon: 'solar:cpu-bolt-bold', color: '#3B82F6' },
  { id: 6, label: 'Audit Ledger', icon: 'solar:history-bold', color: '#10B981' },
  { id: 7, label: 'Approved Output', icon: 'solar:check-circle-bold', color: '#10B981' },
]

export default function AuthLeftPane() {
  const [activeStep, setActiveStep] = useState(0)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    // Cycle through pipeline steps
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 6)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const activeNodes = activeStep === 5 ? [5, 6] : [activeStep]

  return (
    <div
      className="left-pane-container"
      style={{
        flex: 1,
        background: '#020617',
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 36px 32px 84px',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: '100%',
      }}
    >
      {/* Subtle grid pattern */}
      <div className="grid-bg" />

      {/* Ambient Radial Gradient Glow */}
      <div className="glow-spot" style={{ bottom: '-10%', left: '-10%' }} />
      <div className="glow-spot" style={{ top: '10%', right: '-10%', width: '300px', height: '300px' }} />

      {/* Left Vertical Brand Column */}
      <div style={{
        position: 'absolute',
        left: '28px',
        top: '32px',
        bottom: '32px',
        width: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 2,
      }}>
        <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#475569', letterSpacing: '0.35em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textTransform: 'uppercase' }}>
          SECURE
        </span>
        <div style={{ flex: 1, width: '1px', background: 'linear-gradient(to bottom, rgba(71,85,105,0.2) 30%, rgba(255,255,255,0.02) 100%)', margin: '16px 0' }} />
        <span style={{
          fontSize: '2rem',
          fontWeight: 900,
          color: 'rgba(255, 255, 255, 0.018)',
          letterSpacing: '0.12em',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontFamily: 'var(--font-inter), sans-serif',
          textTransform: 'uppercase',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px',
        }}>
          AEGIS
        </span>
      </div>

      {/* Brand & Header */}
      <div className="left-pane-brand-wrapper" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }} className="left-pane-brand-logo">
          <img
            src="/logo-icon.png"
            alt="AegisRAG Logo Icon"
            style={{ width: '22px', height: '22px', objectFit: 'contain' }}
            draggable={false}
          />
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', textTransform: 'uppercase', fontFamily: 'var(--font-inter), sans-serif' }}>
            AEGISRAG
          </span>
          <span style={{
            fontSize: '0.52rem',
            color: '#6366F1',
            borderColor: 'rgba(99, 102, 241, 0.4)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '4px',
            padding: '1px 6px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginLeft: '4px',
          }}>
            ENTERPRISE
          </span>
        </div>

        {/* Premium Meets-Its-Aegis Typography Layout with Info Circle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '20px 0 12px', width: '100%' }} className="header-split-row">
          <span className="hero-meets-text">
            AI governance meets its
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
            <h1 className="hero-aegis-text">
              Aegis<span className="hero-aegis-dot">.</span>
            </h1>

            {/* Simple elegant Info Trigger Button */}
            <button
              onClick={() => setShowInfo(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
                transition: 'all 0.2s ease',
                outline: 'none',
                transform: 'translateY(-10px)',
              }}
              className="info-trigger-btn"
              title="About AegisRAG"
            >
              <Icon icon="solar:info-circle-bold" width={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: SVG Pipeline & Security Specs */}
      <div className="left-pane-grid-horizontal" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', zIndex: 2, margin: '24px 0', width: '100%' }}>
        
        {/* Connection pipeline wrapper */}
        <div style={{
          background: 'rgba(10, 15, 30, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '24px 20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          width: '100%',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Governance Pipeline Monitor
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', color: '#475569', fontFamily: 'monospace' }}>
              NODE_STATE: ACTIVE (CYCLES/SEC: 0.35)
            </span>
          </div>

          <div className="left-pane-svg-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <svg viewBox="0 0 740 100" width="100%" height="100%" style={{ maxHeight: '100px' }}>
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Connection Line */}
              <path d="M 40 40 L 700 40" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="2" />
              <path d="M 40 40 L 700 40" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Glowing flowing data packet */}
              {activeStep < 6 && (
                <circle r="4" fill="#3B82F6" filter="url(#glow)">
                  <animateMotion
                    path={`M ${40 + activeStep * 110} 40 L ${40 + (activeStep === 5 ? 5 : activeStep + 1) * 110} 40`}
                    dur="2.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Render Nodes */}
              {nodes.map((node, index) => {
                const X = 40 + index * 110
                const isActive = activeNodes.includes(index)
                const words = node.label.split(' ')

                return (
                  <g key={node.id} style={{ cursor: 'pointer' }}>
                    <title>{node.label}</title>
                    {/* Pulsing Back Glow Circle */}
                    {isActive && (
                      <circle
                        cx={X}
                        cy={40}
                        r={18}
                        fill="none"
                        stroke={node.color}
                        strokeWidth="1.5"
                        opacity="0.6"
                        style={{
                          animation: 'pulse-ring 1.8s cubic-bezier(0.215, 0.610, 0.355, 1) infinite',
                          transformOrigin: `${X}px 40px`,
                        }}
                      />
                    )}

                    {/* Node Icon Circle */}
                    <circle
                      cx={X}
                      cy={40}
                      r={12}
                      fill={isActive ? 'rgba(59, 130, 246, 0.12)' : '#070C18'}
                      stroke={isActive ? node.color : 'rgba(255, 255, 255, 0.06)'}
                      strokeWidth={isActive ? '1.5' : '1'}
                      style={{ transition: 'all 0.3s ease' }}
                    />

                    {/* Icon Inside Circle */}
                    <foreignObject x={X - 8} y={40 - 8} width={16} height={16}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: isActive ? node.color : '#475569',
                        transition: 'color 0.3s ease',
                      }}>
                        <Icon icon={node.icon} width={11} />
                      </div>
                    </foreignObject>

                    {/* Text Labels */}
                    <text
                      x={X}
                      y={68}
                      fill={isActive ? '#F8FAFC' : '#475569'}
                      textAnchor="middle"
                      style={{
                        fontSize: '9px',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'fill 0.3s ease',
                        fontFamily: 'var(--font-inter), sans-serif',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {words[0]}
                    </text>
                    <text
                      x={X}
                      y={79}
                      fill={isActive ? '#F8FAFC' : '#475569'}
                      textAnchor="middle"
                      style={{
                        fontSize: '9px',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'fill 0.3s ease',
                        fontFamily: 'var(--font-inter), sans-serif',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {words[1]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Security attestation & specifications section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          width: '100%',
        }} className="specifications-grid">
          {[
            { label: 'Cryptographic Engine', value: 'AES-GCM-256', sub: 'Audit Ledger' },
            { label: 'Policy Enforcement', value: 'Zero-Trust Broker', sub: 'Policy Validation' },
            { label: 'Hardware Attestation', value: 'Secure Enclave', sub: 'TPM 2.0 Verified' },
            { label: 'Compliance Mapping', value: 'HIPAA & GDPR', sub: 'Automated Controls' },
          ].map((spec) => (
            <div key={spec.label} style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <span style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {spec.label}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#E2E8F0', fontWeight: 700 }}>
                {spec.value}
              </span>
              <span style={{ fontSize: '0.58rem', color: '#64748B', fontFamily: 'monospace' }}>
                {spec.sub}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* Footer Text */}
      <div className="left-pane-footer" style={{ position: 'relative', zIndex: 2, borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>
          Protected by Aegis Guard™
        </span>
        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
          SECURE CONNECTION
        </span>
      </div>

      {/* Description Overlay Modal */}
      {showInfo && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px',
          animation: 'fadeIn 0.25s ease-out forwards',
        }}>
          <div style={{
            background: 'rgba(11, 17, 32, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '16px',
            padding: '32px 28px',
            maxWidth: '460px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.1)',
            position: 'relative',
            animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowInfo(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '4px',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
            >
              <Icon icon="solar:close-circle-bold" width={20} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img
                src="/logo-icon.png"
                alt="AegisRAG Logo"
                style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                AEGISRAG
              </span>
            </div>

            {/* Modal Content */}
            <p style={{ color: '#E2E8F0', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 16px', fontWeight: 500 }}>
              AegisRAG is the enterprise operating system for AI Governance, Compliance, Security and Trust.
            </p>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', lineHeight: '1.5', margin: 0 }}>
              Secure vector contexts, enforce corporate boundaries, and log cryptographic audit records instantly. Built for mission-critical deployments where security is non-negotiable.
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        .grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(59, 130, 246, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.015) 1px, transparent 1px);
          background-size: 24px 24px;
          pointer-events: none;
          z-index: 1;
        }
        .glow-spot {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.04) 0%, rgba(3, 7, 18, 0) 70%);
          pointer-events: none;
          z-index: 1;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.75);
            opacity: 0.8;
          }
          80%, 100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .pulse-dot {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        
        .info-trigger-btn:hover {
          background: rgba(99, 102, 241, 0.15) !important;
          border-color: rgba(99, 102, 241, 0.4) !important;
          color: #FFFFFF !important;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3) !important;
        }

        .hero-meets-text {
          font-size: 2.1rem;
          font-weight: 300;
          color: #94A3B8;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }
        .hero-aegis-text {
          font-size: 5.2rem;
          font-weight: 900;
          color: #FFFFFF;
          letter-spacing: -0.05em;
          line-height: 0.95;
          margin: 4px 0 0 0;
          display: flex;
          align-items: baseline;
        }
        .hero-aegis-dot {
          color: #6366F1;
          text-shadow: 0 0 16px rgba(99, 102, 241, 0.85);
          font-size: 5.2rem;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        /* Height-based responsiveness for standard monitors with low heights */
        @media (max-height: 720px) {
          .left-pane-container {
            padding: 16px 20px !important;
          }
          .left-pane-brand-logo {
            margin-bottom: 8px !important;
          }
          .hero-meets-text {
            font-size: 1.4rem !important;
          }
          .hero-aegis-text {
            font-size: 3.6rem !important;
          }
          .hero-aegis-dot {
            font-size: 3.6rem !important;
          }
          .left-pane-grid-horizontal {
            margin: 6px 0 !important;
            gap: 12px !important;
          }
          .specifications-grid {
            gap: 10px !important;
          }
          .left-pane-footer {
            padding-top: 10px !important;
          }
        }

        @media (max-width: 1200px) {
          .specifications-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}
