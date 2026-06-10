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
  const [time, setTime] = useState('')

  useEffect(() => {
    // Cycle through pipeline steps
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 6)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString())
    }
    updateTime()
    const tInterval = setInterval(updateTime, 1000)
    return () => clearInterval(tInterval)
  }, [])

  const activeNodes = activeStep === 5 ? [5, 6] : [activeStep]

  const getGovernanceInsights = () => {
    switch (activeStep) {
      case 0:
        return [
          { label: 'Data Residency', value: 'US East (N. Virginia)', status: 'Verified', color: '#10B981' },
          { label: 'Access Control', value: 'RBAC Enforced', status: 'Secure', color: '#10B981' },
          { label: 'Ingestion Status', value: 'Evaluating context chunks', status: 'Pending', color: '#3B82F6' },
        ]
      case 1:
        return [
          { label: 'Retrieval Strategy', value: 'Hybrid Semantic + Vector', status: 'Active', color: '#10B981' },
          { label: 'Context Windows', value: '4 Source Blocks Loaded', status: 'Grounded', color: '#10B981' },
          { label: 'Safety Filters', value: 'Initializing policy scan', status: 'Running', color: '#F59E0B' },
        ]
      case 2:
        return [
          { label: 'Content Safety', value: '0 Violations Detected', status: 'Passed', color: '#10B981' },
          { label: 'Prompt Injection Gate', value: 'Score: 0.99 (Safe)', status: 'Cleared', color: '#10B981' },
          { label: 'Groundedness Index', value: 'Calculating citation match', status: 'Running', color: '#3B82F6' },
        ]
      case 3:
        return [
          { label: 'Hallucination Check', value: 'Score: 0.02 (Negligible)', status: 'Passed', color: '#10B981' },
          { label: 'PII Scrubbing', value: '0 Sensitive Records Found', status: 'Clean', color: '#10B981' },
          { label: 'Compliance Audit', value: 'Validating HIPAA/GDPR constraints', status: 'Running', color: '#8B5CF6' },
        ]
      case 4:
        return [
          { label: 'Compliance Clearance', value: '100% Alignment verified', status: 'Passed', color: '#10B981' },
          { label: 'Data Sovereign Log', value: 'Queueing to secure ledger', status: 'Active', color: '#3B82F6' },
          { label: 'Audit Signature', value: 'Generating HMAC sha256', status: 'Running', color: '#F59E0B' },
        ]
      case 5:
        return [
          { label: 'Cryptographic Ledger', value: 'Block #89104 committed', status: 'Verified', color: '#10B981' },
          { label: 'PII & Safety Shield', value: 'Filters active (100% Safe)', status: 'Enforced', color: '#10B981' },
          { label: 'Approved Output', value: 'Signed token generated', status: 'Ready', color: '#10B981' },
        ]
      default:
        return []
    }
  }

  const getConsoleLogs = () => {
    const ts = time || '14:14:23'
    switch (activeStep) {
      case 0:
        return [
          `[${ts}] INCOMING: Query request initiated`,
          `[${ts}] PIPELINE: Resolving knowledge vectors...`
        ]
      case 1:
        return [
          `[${ts}] PIPELINE: Knowledge retrieved (score: 0.96)`,
          `[${ts}] SECURITY: Initiating safety gate evaluation...`
        ]
      case 2:
        return [
          `[${ts}] SECURITY: Safety policies passed (0 triggers)`,
          `[${ts}] ATTEST: Running groundedness analysis...`
        ]
      case 3:
        return [
          `[${ts}] ATTEST: Groundedness verified (score: 0.98)`,
          `[${ts}] COMPLIANCE: Auditing HIPAA / GDPR rules...`
        ]
      case 4:
        return [
          `[${ts}] COMPLIANCE: 100% compliance score verified`,
          `[${ts}] LEDGER: Executing cryptographic audit write...`
        ]
      case 5:
        return [
          `[${ts}] LEDGER: Audit write committed (block=89104)`,
          `[${ts}] PIPELINE: Safe response signed & authorized!`
        ]
      default:
        return []
    }
  }

  return (
    <div
      className="left-pane-container"
      style={{
        flex: 1,
        background: '#030712',
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 36px',
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

      {/* Brand & Header */}
      <div className="left-pane-brand-wrapper" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }} className="left-pane-brand-logo">
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon="solar:shield-check-bold" width={16} style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC', margin: 0, letterSpacing: '-0.01em' }}>
              Governance Intelligence Network
            </h2>
            <span style={{ fontSize: '0.58rem', color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AegisRAG Node Console
            </span>
          </div>
        </div>

        <h1
          className="left-pane-title"
          style={{
            fontSize: '1.65rem',
            fontWeight: 700,
            color: '#F8FAFC',
            lineHeight: '1.25',
            letterSpacing: '-0.03em',
            margin: '0 0 10px',
            maxWidth: '520px',
          }}
        >
          Trust Every Decision.
        </h1>
        <p className="left-pane-description" style={{ color: '#64748B', fontSize: '0.82rem', lineHeight: '1.5', margin: '0 0 16px', maxWidth: '520px' }}>
          AegisRAG is the enterprise operating system for AI Governance, Compliance, Security and Trust. Secure vector contexts, enforce corporate boundaries, and log cryptographic audit records instantly.
        </p>
      </div>

      {/* Main Grid: SVG Pipeline Left, Telemetry & Status Right */}
      <div className="left-pane-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '24px', position: 'relative', zIndex: 2, margin: '12px 0', width: '100%' }}>

        {/* Left Column: Animated SVG Pipeline */}
        <div className="left-pane-svg-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '16px 12px', height: '360px' }}>
          <svg viewBox="0 0 320 365" width="100%" height="100%" style={{ maxHeight: '340px' }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connection Line */}
            <path d="M 30 25 L 30 337" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="2" />
            <path d="M 30 25 L 30 337" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1" strokeDasharray="4 4" />

            {/* Glowing flowing data packets */}
            {activeStep < 5 && (
              <circle r="4" fill="#3B82F6" filter="url(#glow)">
                <animateMotion
                  path={`M 30 ${25 + activeStep * 52} L 30 ${25 + (activeStep + 1) * 52}`}
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {activeStep === 5 && (
              <circle r="4" fill="#10B981" filter="url(#glow)">
                <animateMotion
                  path="M 30 25 L 30 337"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Render Nodes */}
            {nodes.map((node, index) => {
              const Y = 25 + index * 52
              const isActive = activeNodes.includes(index)

              return (
                <g key={node.id} style={{ cursor: 'pointer' }}>
                  <title>{node.label}</title>
                  {/* Pulsing Back Glow Circle */}
                  {isActive && (
                    <circle
                      cx={30}
                      cy={Y}
                      r={20}
                      fill="none"
                      stroke={node.color}
                      strokeWidth="1.5"
                      opacity="0.6"
                      style={{
                        animation: 'pulse-ring 1.8s cubic-bezier(0.215, 0.610, 0.355, 1) infinite',
                        transformOrigin: `30px ${Y}px`,
                      }}
                    />
                  )}

                  {/* Node Icon Circle */}
                  <circle
                    cx={30}
                    cy={Y}
                    r={14}
                    fill={isActive ? 'rgba(59, 130, 246, 0.12)' : '#070C18'}
                    stroke={isActive ? node.color : 'rgba(255, 255, 255, 0.06)'}
                    strokeWidth={isActive ? '1.5' : '1'}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* Icon Inside Circle */}
                  <foreignObject x={18} y={Y - 12} width={24} height={24}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      color: isActive ? node.color : '#475569',
                      transition: 'color 0.3s ease',
                    }}>
                      <Icon icon={node.icon} width={13} />
                    </div>
                  </foreignObject>

                  {/* Text Label */}
                  <text
                    x={56}
                    y={Y + 4}
                    fill={isActive ? '#F8FAFC' : '#475569'}
                    style={{
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'fill 0.3s ease',
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Right Column: Active Governance Insights & Live Audit Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }} className="left-pane-right-col">

          {/* Active Governance Insights */}
          <div className="left-pane-insights" style={{
            background: 'rgba(10, 15, 30, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}>
            <div className="left-pane-insights-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Icon icon="solar:shield-up-bold" style={{ color: '#3B82F6' }} width={14} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Active Governance Insights
              </span>
            </div>

            <div className="left-pane-insights-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {getGovernanceInsights().map((insight) => (
                <div key={insight.label} className="left-pane-insights-item" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  paddingBottom: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>{insight.label}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: insight.color, background: `${insight.color}10`, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {insight.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600 }}>
                    {insight.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Console Log (Live Audit Feed) */}
          <div className="left-pane-terminal-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>LIVE AUDIT FEED</span>
            <div className="left-pane-terminal" style={{
              background: '#040811',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '0.68rem',
              lineHeight: '1.5',
              color: '#64748B',
              minHeight: '62px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              {getConsoleLogs().map((log, idx) => (
                <div key={idx} style={{ color: idx === 1 ? '#3B82F6' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>

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
        
        /* Height-based responsiveness for standard monitors with low heights (e.g. 1280x600, laptop screens) */
        @media (max-height: 720px) {
          .left-pane-container {
            padding: 16px 20px !important;
          }
          .left-pane-brand-logo {
            margin-bottom: 8px !important;
          }
          .left-pane-title {
            font-size: 1.35rem !important;
            margin-bottom: 6px !important;
          }
          .left-pane-description {
            font-size: 0.72rem !important;
            line-height: 1.4 !important;
            margin-bottom: 10px !important;
          }
          .left-pane-grid {
            margin: 6px 0 !important;
            gap: 12px !important;
          }
          .left-pane-svg-container {
            height: 240px !important;
            padding: 8px !important;
          }
          .left-pane-right-col {
            gap: 10px !important;
          }
          .left-pane-insights {
            padding: 10px 12px !important;
          }
          .left-pane-insights-header {
            margin-bottom: 8px !important;
          }
          .left-pane-insights-list {
            gap: 6px !important;
          }
          .left-pane-insights-item {
            padding-bottom: 4px !important;
            gap: 2px !important;
          }
          .left-pane-terminal-wrapper {
            gap: 4px !important;
          }
          .left-pane-terminal {
            padding: 8px 10px !important;
            min-height: 48px !important;
          }
          .left-pane-footer {
            padding-top: 10px !important;
          }
        }

        @media (max-width: 1200px) {
          .left-pane-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .left-pane-svg-container {
            height: 380px !important;
          }
        }
      `}</style>
    </div>
  )
}
