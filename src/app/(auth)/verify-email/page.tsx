'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false)
  const [resentCount, setResentCount] = useState(0)

  function handleResend() {
    setIsResending(true)
    setTimeout(() => {
      setIsResending(false)
      setResentCount((c) => c + 1)
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
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#38BDF8',
        }}
      >
        <Icon icon="solar:letter-opened-bold" width={24} />
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
        Verify Email
      </h1>
      <p style={{ color: '#64748B', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 32px' }}>
        We have sent a verification link to your email address. Please click the link to activate your account.
      </p>

      {resentCount > 0 && (
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
          <Icon icon="solar:check-circle-bold" width={14} />
          <span>Verification email resent successfully.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          onClick={handleResend}
          disabled={isResending}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'transparent',
            border: '1px solid #1F2937',
            borderRadius: '6px',
            color: '#F8FAFC',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: isResending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
          className="btn-resend"
        >
          {isResending ? (
            <>
              <Icon icon="eos-icons:loading" width={14} />
              Sending...
            </>
          ) : (
            'Resend Verification Email'
          )}
        </button>

        <a
          href="/login"
          style={{
            fontSize: '0.82rem',
            color: '#64748B',
            textDecoration: 'none',
            fontWeight: 600,
            marginTop: '12px',
          }}
          className="btn-back"
        >
          Return to Sign In
        </a>
      </div>

      <style jsx>{`
        .btn-resend:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.01) !important;
          border-color: #374151 !important;
        }
        .btn-back:hover {
          color: #3B82F6 !important;
        }
      `}</style>
    </div>
  )
}
