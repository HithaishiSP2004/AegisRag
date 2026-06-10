'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'

export default function SessionTimeoutPage() {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit() {
    setIsSubmitting(true)
  }

  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 12px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: '#F8FAFC',
            margin: '0 0 10px',
            letterSpacing: '-0.03em',
          }}
        >
          Session Timeout
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>
          Your session was locked automatically due to inactivity.
        </p>
      </div>

      {/* User profile capsule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#090D16',
          border: '1px solid #1F2937',
          borderRadius: '6px',
          padding: '12px 14px',
          margin: '24px 0',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#0F172A',
            border: '1px solid #1F2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#3B82F6',
            flexShrink: 0,
          }}
        >
          SA
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#E2E8F0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Super Admin
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            super.admin@aegisrag.demo
          </div>
        </div>
        <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Icon icon="solar:shield-keyhole-bold" width={16} />
        </div>
      </div>

      <form action="/auth/login" method="POST" onSubmit={handleSubmit}>
        <input type="hidden" name="email" value="super.admin@aegisrag.demo" />

        <div style={{ marginBottom: '28px', textAlign: 'left' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            Enter password to resume
          </label>
          <input
            type="password"
            name="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#090D16',
              border: '1px solid #1F2937',
              borderRadius: '6px',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.15s ease',
            }}
            className="auth-input"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#2563EB',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease',
            marginBottom: '20px',
          }}
          className="btn-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Resuming session...
            </>
          ) : (
            'Resume Session'
          )}
        </button>

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
          Sign in as different user
        </a>
      </form>

      <style jsx>{`
        :global(.auth-input:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
        }
        .btn-submit:hover:not(:disabled) {
          background-color: #1D4ED8 !important;
        }
        .btn-back:hover {
          color: #3B82F6 !important;
        }
      `}</style>
    </div>
  )
}
