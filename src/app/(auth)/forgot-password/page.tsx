'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useSearchParams } from 'next/navigation'

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const sent = searchParams.get('sent') === 'true'
  const emailParam = searchParams.get('email') || ''

  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit() {
    setIsSubmitting(true)
  }

  // --- RENDER SENT / SUCCESS STATE ---
  if (sent) {
    return (
      <div
        style={{
          background: 'transparent',
          padding: '0 4px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#10B981',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
          }}
        >
          <Icon icon="solar:paper-plane-bold-duotone" width={28} />
        </div>
        <h1
          style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: '#F8FAFC',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
          }}
        >
          Recovery Link Sent
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 28px' }}>
          A secure verification link has been dispatched to <strong style={{ color: '#E2E8F0' }}>{emailParam}</strong>.
        </p>

        <a
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            color: '#F8FAFC',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          className="btn-sso"
        >
          <Icon icon="solar:arrow-left-bold" width={14} />
          Return to Sign In
        </a>
        <style jsx>{`
          .btn-sso {
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .btn-sso:hover {
            transform: scale(1.02);
            background-color: rgba(255, 255, 255, 0.02) !important;
            border-color: rgba(255, 255, 255, 0.15) !important;
          }
        `}</style>
      </div>
    )
  }

  // --- RENDER FORGOT PASSWORD FORM ---
  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 4px 8px',
      }}
    >
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            color: '#F8FAFC',
            margin: '0 0 6px',
            letterSpacing: '-0.04em',
            background: 'linear-gradient(to bottom, #FFFFFF 60%, #94A3B8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Recover Access
        </h1>
        <p style={{ color: '#3B82F6', fontSize: '0.8rem', fontWeight: 600, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Corporate Identity Verification
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '6px',
            padding: '12px',
            color: '#FCA5A5',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px',
          }}
        >
          <Icon icon="solar:danger-triangle-bold" width={16} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form action="/auth/forgot-password" method="POST" onSubmit={handleSubmit}>
        {/* Email Field */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '8px' }}>
            Work Email
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#090D16',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="auth-input"
          />
        </div>

        {/* Send Recovery Link CTA */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: '#2563EB',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '28px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
          className="btn-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Sending...
            </>
          ) : (
            'Send Recovery Link'
          )}
        </button>
      </form>

      {/* Small Security Note */}
      <div
        style={{
          marginTop: '24px',
          background: 'rgba(59, 130, 246, 0.02)',
          border: '1px solid rgba(59, 130, 246, 0.06)',
          borderRadius: '6px',
          padding: '12px 14px',
          display: 'flex',
          gap: '8px',
        }}
      >
        <Icon icon="solar:shield-unique-bold" width={16} style={{ color: '#3B82F6', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, color: '#64748B', fontSize: '0.74rem', lineHeight: '1.4' }}>
          Verification links expire in 15 minutes. Secure log events are registered for compliance auditing.
        </p>
      </div>

      {/* Return link */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a href="/login" style={{ color: '#3B82F6', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }} className="hover-link">
          Back to Sign In
        </a>
      </div>

      <style jsx>{`
        :global(.auth-input:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
          background: rgba(9, 13, 22, 0.9) !important;
        }
        
        .btn-submit {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-submit:hover:not(:disabled) {
          transform: scale(1.02);
          background-color: #3B82F6 !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4) !important;
        }
        
        .hover-link:hover {
          text-decoration: underline !important;
          color: #60A5FA !important;
        }
      `}</style>
    </div>
  )
}
