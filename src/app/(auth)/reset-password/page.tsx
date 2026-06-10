'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const isSuccess = searchParams.get('success') === 'true'
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Password rules validation
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0

  const strengthCount = [hasMinLength, hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  const strengthText = ['Weak', 'Moderate', 'Strong', 'Excellent'][strengthCount - 1] || 'Required'
  const strengthColor = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'][strengthCount - 1] || '#475569'

  function handleSubmit(e: React.FormEvent) {
    if (strengthCount < 3) {
      e.preventDefault()
      toast.warning('Password strength is insufficient (must satisfy at least 3 rules).')
      return
    }
    if (!passwordsMatch) {
      e.preventDefault()
      toast.error('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
  }

  // --- RENDER SUCCESS STATE ---
  if (isSuccess) {
    return (
      <div
        style={{
          background: 'transparent',
          padding: '0 4px',
          textAlign: 'center',
        }}
      >
        {/* Large Success Indicator */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: '#10B981',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.15)',
            animation: 'pulse-green 2s infinite ease-in-out',
          }}
        >
          <Icon icon="solar:check-circle-bold-duotone" width={36} />
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#F8FAFC',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(to bottom, #FFFFFF, #CBD5E1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Access Restored
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 28px' }}>
          Your security credentials have been updated and verified.
        </p>

        {/* Audit Event Logged Box */}
        <div
          style={{
            background: '#090D16',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            padding: '14px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            color: '#64748B',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: 600, marginBottom: '6px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', animation: 'pulse-green 1s infinite' }} />
            AUDIT EVENT LOGGED
          </div>
          <div style={{ color: '#E2E8F0', marginTop: '4px' }}>
            <span style={{ color: '#475569' }}>&gt;</span> USR_AUTH_RESET: Password updated successfully.
          </div>
          <div style={{ color: '#475569', marginTop: '2px' }}>
            <span>&gt;</span> SYS_VAL: Core session tokens rotated.
          </div>
          <div style={{ color: '#475569', marginTop: '2px' }}>
            <span>&gt;</span> SEC_REP: Compliance ledger record committed.
          </div>
        </div>

        {/* Continue to Workspace Button */}
        <a
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '14px 16px',
            background: '#2563EB',
            borderRadius: '6px',
            color: '#FFFFFF',
            fontSize: '0.95rem',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
          className="btn-submit"
        >
          Continue to Workspace
          <Icon icon="solar:arrow-right-bold" width={16} />
        </a>

        <style jsx>{`
          @keyframes pulse-green {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.03); opacity: 0.8; }
          }
          .btn-submit {
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .btn-submit:hover {
            transform: scale(1.02);
            background-color: #3B82F6 !important;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.4) !important;
          }
        `}</style>
      </div>
    )
  }

  // --- RENDER RESET FORM STATE ---
  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 4px',
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
          Reset Password
        </h1>
        <p style={{ color: '#3B82F6', fontSize: '0.8rem', fontWeight: 600, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Define New Credentials
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

      <form action="/auth/reset-password" method="POST" onSubmit={handleSubmit}>
        {/* Password Field */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '8px' }}>
            New Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 42px 12px 14px',
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

          {/* Password strength indicators */}
          {password.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Password Strength:</span>
                <span style={{ fontSize: '0.65rem', color: strengthColor, fontWeight: 700 }}>{strengthText}</span>
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    style={{
                      flex: 1,
                      height: '2px',
                      borderRadius: '10px',
                      background: step <= strengthCount ? strengthColor : 'rgba(255,255,255,0.03)',
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '8px' }}>
                <div style={{ fontSize: '0.65rem', color: hasMinLength ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon icon={hasMinLength ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={10} />
                  8+ characters
                </div>
                <div style={{ fontSize: '0.65rem', color: hasUpper ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon icon={hasUpper ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={10} />
                  Uppercase letter
                </div>
                <div style={{ fontSize: '0.65rem', color: hasNumber ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon icon={hasNumber ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={10} />
                  One number
                </div>
                <div style={{ fontSize: '0.65rem', color: hasSymbol ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon icon={hasSymbol ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={10} />
                  Special symbol
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '8px' }}>
            Confirm Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              required
              placeholder="Match original password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {confirmPassword.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: passwordsMatch ? '#10B981' : '#EF4444',
                }}
              >
                <Icon icon={passwordsMatch ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={16} />
              </span>
            )}
          </div>
        </div>

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
              Resetting password...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

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
      `}</style>
    </div>
  )
}
