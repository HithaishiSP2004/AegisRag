'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useToast } from '@/components/ui'
import Interactive3DLogo from '@/components/ui/Interactive3DLogo'

interface LoginFormProps {
  error?: string
}

export default function LoginForm({ error }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  function handleSubmit() {
    setIsSubmitting(true)
  }

  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 4px 8px',
      }}
    >
      {/* Header with Brand and Subtitle */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        {/* 3D Interactive Logo — tracks cursor across the whole page */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Interactive3DLogo size={88} variant="icon" isSubmitting={isSubmitting} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', margin: '12px 0 4px', letterSpacing: '-0.02em' }}>
          Sign in to AegisRAG
        </h3>
        <p style={{ color: '#64748B', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>
          Secure access to your governance workspace
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '6px',
            padding: '10px 12px',
            color: '#FCA5A5',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <Icon icon="solar:danger-triangle-bold" width={16} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span>{error === 'Invalid credentials' ? 'Invalid email or password.' : error}</span>
        </div>
      )}

      <form action="/auth/login" method="POST" onSubmit={handleSubmit}>
        {/* Email Field */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
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
              padding: '11px 13px',
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

        {/* Password Field */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500 }}>
              Password
            </label>
            <a
              href="/forgot-password"
              style={{ color: '#3B82F6', fontSize: '0.78rem', fontWeight: 500, textDecoration: 'none' }}
              className="hover-link"
            >
              Forgot password?
            </a>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 42px 11px 13px',
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
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} width={16} />
            </button>
          </div>
        </div>

        {/* Remember Device Checkbox */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              name="remember"
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: '#090D16',
                accentColor: '#3B82F6',
                cursor: 'pointer',
              }}
            />
            Remember device
          </label>
        </div>

        {/* Access Workspace (Primary CTA) */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '13px 16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
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
            marginTop: '18px',
            marginBottom: '12px',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
          }}
          className="btn-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Accessing...
            </>
          ) : (
            'Access Workspace'
          )}
        </button>
      </form>

      {/* SSO Divider */}
      <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: '12px' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.05)' }} />
        <span style={{ color: '#475569', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em' }}>OR</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.05)' }} />
      </div>

      {/* Continue with Enterprise SSO (Secondary CTA) */}
      <button
        type="button"
        style={{
          width: '100%',
          padding: '11px 16px',
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          color: '#E2E8F0',
          fontWeight: 500,
          fontSize: '0.88rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
        onClick={() => toast.info('Enterprise SSO redirection (Simulated)')}
        className="btn-sso"
      >
        <Icon icon="solar:keyhole-bold" width={14} style={{ color: '#64748B' }} />
        Continue with Enterprise SSO
      </button>

      {/* Sign Up */}
      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>
          Don't have an organization?{' '}
          <a href="/signup" style={{ color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }} className="hover-link">
            Create Workspace
          </a>
        </p>
      </div>

      {/* Subtle Trust Badges Footer */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px', opacity: 0.45, borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '16px' }}>
        {['SOC2 Type II', 'ISO27001', 'GDPR', 'HIPAA'].map((badge) => (
          <span key={badge} style={{ fontSize: '0.68rem', fontWeight: 600, color: '#E2E8F0', letterSpacing: '0.05em' }}>
            {badge}
          </span>
        ))}
      </div>

      <style jsx>{`
        :global(.auth-input:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
          background: rgba(9, 13, 22, 0.9) !important;
        }

        /* Microinteractions: Buttons hover glow and scale */
        .btn-submit {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-submit:hover:not(:disabled) {
          transform: scale(1.015);
          background: linear-gradient(135deg, #5850ec 0%, #4893ff 100%) !important;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35) !important;
        }

        .btn-sso {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-sso:hover {
          transform: scale(1.02);
          background-color: rgba(255, 255, 255, 0.02) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.03) !important;
        }

        .hover-link:hover {
          text-decoration: underline !important;
          color: #60A5FA !important;
        }
      `}</style>
    </div>
  )
}
