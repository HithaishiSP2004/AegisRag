'use client'

import { useState, useRef } from 'react'
import { Icon } from '@iconify/react'

export default function MfaSetupPage() {
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const secretKey = 'AEGIS RAG X72K 99PL WQ41'

  function handleCopy() {
    navigator.clipboard.writeText(secretKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleInputChange(index: number, val: string) {
    const next = [...code]
    next[index] = val.slice(-1) // limit to 1 char
    setCode(next)

    // Move focus to next input
    if (val !== '' && index < 5) {
      inputRefs[index + 1].current?.focus()
    }
  }

  // Handle paste in MFA cells
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedText)) {
      const chars = pastedText.split('')
      setCode(chars)
      chars.forEach((char, idx) => {
        if (inputRefs[idx]?.current) {
          inputRefs[idx].current!.value = char
        }
      })
      inputRefs[5].current?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setVerified(true)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1200)
    }, 1500)
  }

  if (verified) {
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
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: '#10B981',
          }}
        >
          <Icon icon="solar:shield-check-bold" width={24} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#F8FAFC', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          MFA Enrolled
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '0 0 32px', lineHeight: '1.5' }}>
          Your authenticator device has been successfully linked to your account.
        </p>
        <span style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Icon icon="eos-icons:loading" width={14} />
          Redirecting to workspace...
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'transparent',
        padding: '0 12px',
      }}
    >
      <div style={{ marginBottom: '40px' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: '#F8FAFC',
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          Configure MFA
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', marginTop: '10px', margin: 0, lineHeight: '1.5' }}>
          Scan the QR code below to register your authenticator application.
        </p>
      </div>

      <form onSubmit={handleVerify}>
        {/* QR & Secret */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#090D16', padding: '16px', borderRadius: '6px', marginBottom: '28px', border: '1px solid #1F2937' }}>
          {/* Mock QR code using SVG */}
          <div
            style={{
              width: '88px',
              height: '88px',
              background: '#FFFFFF',
              borderRadius: '4px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="76" height="76" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0H28V28H0V0ZM4 4V24H24V4H4Z" fill="#030712" />
              <path d="M8 8H20V20H8V8Z" fill="#030712" />
              <path d="M60 0H88V28H60V0ZM64 4V24H84V4H64Z" fill="#030712" />
              <path d="M68 8H80V20H68V8Z" fill="#030712" />
              <path d="M0 60H28V88H0V60ZM4 64V84H24V64H4Z" fill="#030712" />
              <path d="M8 68H20V80H8V68Z" fill="#030712" />
              <path d="M36 4H44V12H36V4ZM48 8H56V16H48V8ZM40 20H48V28H40V20ZM36 36H48V44H36V36ZM52 36H60V44H52V36ZM40 48H48V60H40V48ZM36 68H44V76H36V68ZM48 76H56V84H48V76ZM68 36H76V48H68V36ZM80 40H88V48H80V40ZM64 52H72V64H64V52ZM80 56H88V68H80V56ZM72 72H80V84H72V72ZM60 76H68V88H60V76ZM80 76H88V88H80V76Z" fill="#030712" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Secret Key</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code style={{ fontSize: '0.82rem', color: '#3B82F6', fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secretKey}</code>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                title="Copy secret key"
              >
                <Icon icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={14} style={{ color: copied ? '#10B981' : '#475569' }} />
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: '6px' }}>
              Enter manually if scanning is not possible.
            </span>
          </div>
        </div>

        {/* 6 Digit Input Cells */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px' }}>
            One-Time Passcode
          </label>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            {code.map((val, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                pattern="[0-9]*"
                maxLength={1}
                value={val}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                style={{
                  width: '100%',
                  height: '48px',
                  textAlign: 'center',
                  background: '#090D16',
                  border: '1px solid #1F2937',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                }}
                className="mfa-cell"
              />
            ))}
          </div>
        </div>

        {/* Verify button */}
        <button
          type="submit"
          disabled={isVerifying || code.some((c) => c === '')}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#2563EB',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: (isVerifying || code.some((c) => c === '')) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease',
            opacity: (isVerifying || code.some((c) => c === '')) ? 0.6 : 1,
          }}
          className="btn-submit"
        >
          {isVerifying ? (
            <>
              <Icon icon="eos-icons:loading" width={16} />
              Verifying passcode...
            </>
          ) : (
            'Verify and Enroll'
          )}
        </button>
      </form>

      <style jsx>{`
        :global(.mfa-cell:focus) {
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
