'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui'

export default function InviteUserPage() {
  const searchParams = useSearchParams()
  const inviter = searchParams.get('inviter') || 'Hithaishi'
  const organization = searchParams.get('org') || 'Acme Corp'
  const invitedEmail = searchParams.get('email') || 'team.member@acme.com'
  const toast = useToast()

  const [fullName, setFullName] = useState('')
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

  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 12px',
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
          Join Workspace
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>
          Initialize your credentials to join <strong style={{ color: '#E2E8F0' }}>{organization}</strong>.
        </p>
      </div>

      {/* Inviter Info Card */}
      <div
        style={{
          background: 'rgba(37, 99, 235, 0.04)',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          borderRadius: '6px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '28px',
        }}
      >
        <Icon icon="solar:user-speak-bold" width={20} style={{ color: '#3B82F6', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', color: '#CBD5E1', lineHeight: '1.5' }}>
          <strong style={{ color: '#F8FAFC' }}>{inviter}</strong> has invited you to join the team as an administrator.
        </span>
      </div>

      <form action="/auth/signup" method="POST" onSubmit={handleSubmit}>
        <input type="hidden" name="email" value={invitedEmail} />
        <input type="hidden" name="orgName" value={organization} />

        {/* Invited Email Address */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            Invitation Email
          </label>
          <input
            type="email"
            disabled
            value={invitedEmail}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#090D16',
              border: '1px solid #1F2937',
              borderRadius: '6px',
              color: '#64748B',
              fontSize: '0.9rem',
              cursor: 'not-allowed',
            }}
          />
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            Full Name
          </label>
          <input
            type="text"
            name="fullName"
            required
            placeholder="Alex Carter"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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

        {/* Create Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            Create Password
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
                border: '1px solid #1F2937',
                borderRadius: '6px',
                color: '#F8FAFC',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'all 0.15s ease',
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

          {/* Password strength visualizer */}
          {password.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Password Strength:</span>
                <span style={{ fontSize: '0.68rem', color: strengthColor, fontWeight: 700 }}>{strengthText}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '10px',
                      background: step <= strengthCount ? strengthColor : 'rgba(255,255,255,0.03)',
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            Confirm Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              required
              placeholder="Match password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

        {/* Submit */}
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
          }}
          className="btn-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Accepting invite...
            </>
          ) : (
            'Accept Invite & Create Account'
          )}
        </button>
      </form>

      <style jsx>{`
        :global(.auth-input:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
        }
        .btn-submit:hover:not(:disabled) {
          background-color: #1D4ED8 !important;
        }
      `}</style>
    </div>
  )
}
