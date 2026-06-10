'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'

export default function AccountLockedPage() {
  const [requestSent, setRequestSent] = useState(false)
  const [isSending, setIsSending] = useState(false)

  function handleRequestUnlock() {
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      setRequestSent(true)
    }, 1200)
  }

  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 12px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#EF4444',
        }}
      >
        <Icon icon="solar:lock-bold" width={24} />
      </div>

      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 600,
          color: '#F8FAFC',
          margin: '0 0 10px',
          letterSpacing: '-0.03em',
        }}
      >
        Account Locked
      </h1>
      <p style={{ color: '#64748B', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 32px' }}>
        This profile has been temporarily locked due to multiple consecutive login failures.
      </p>

      {/* Audit Log Context */}
      <div
        style={{
          background: '#090D16',
          border: '1px solid #1F2937',
          borderRadius: '6px',
          padding: '16px',
          fontSize: '0.78rem',
          textAlign: 'left',
          color: '#64748B',
          fontFamily: 'monospace',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>POLICY LIMIT:</span>
          <span style={{ color: '#EF4444', fontWeight: 600 }}>5 FAILED ATTEMPTS</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>IP ADDRESS:</span>
          <span style={{ color: '#E2E8F0' }}>192.168.1.185</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>TIMESTAMP:</span>
          <span style={{ color: '#E2E8F0' }}>2026-06-08 21:44:12</span>
        </div>
      </div>

      {requestSent ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '6px',
            padding: '12px',
            color: '#10B981',
            fontSize: '0.82rem',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Icon icon="solar:check-circle-bold" width={16} />
          <span>Unlock request sent to Security team.</span>
        </div>
      ) : (
        <button
          onClick={handleRequestUnlock}
          disabled={isSending}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#DC2626',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: isSending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease',
            marginBottom: '24px',
          }}
          className="btn-unlock"
        >
          {isSending ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Sending request...
            </>
          ) : (
            'Request Account Unlock'
          )}
        </button>
      )}

      <a
        href="/login"
        style={{
          fontSize: '0.82rem',
          color: '#64748B',
          textDecoration: 'none',
          fontWeight: 600,
        }}
        className="btn-back"
      >
        Return to Sign In
      </a>

      <style jsx>{`
        .btn-unlock:hover:not(:disabled) {
          background-color: #B91C1C !important;
        }
        .btn-back:hover {
          color: #3B82F6 !important;
        }
      `}</style>
    </div>
  )
}
