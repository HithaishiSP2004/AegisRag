'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'
import { FEATURES } from '@/config/features'
import Interactive3DLogo from '@/components/ui/Interactive3DLogo'

export default function SignupPage() {
  const router = useRouter()
  const toast = useToast()

  // Stepper State
  // 1 = Email / Domain Verification
  // 2 = OTP Identity Check
  // 3 = Workspace Setup / Discovery
  const [step, setStep] = useState(1)

  // Universal Loading state
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track focused input (kept for potential future use; inputs still call these)
  const [, setFocusedInput] = useState<string | null>(null)

  // Step 1: Domain Check State
  const [email, setEmail] = useState('')
  const [isTurnstileVerified, setIsTurnstileVerified] = useState(false)
  const [isTurnstileVerifying, setIsTurnstileVerifying] = useState(false)

  // Step 2: OTP State
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [otpError, setOtpError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Step 3: Discovery State
  const [workspaceExists, setWorkspaceExists] = useState(false)
  const [existingOrgId, setExistingOrgId] = useState('')
  const [existingOrgName, setExistingOrgName] = useState('')
  const [domain, setDomain] = useState('')

  // Step 3 (Case A): New Workspace Fields
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [compliance, setCompliance] = useState('SOC2')
  const [llmEngine, setLlmEngine] = useState('gemini-2.5-pro')
  const [region, setRegion] = useState('us-east-1')
  const [jobRole, setJobRole] = useState('')

  // Password rules validation
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0
  const strengthCount = [hasMinLength, hasUpper, hasNumber, hasSymbol].filter(Boolean).length

  // Refs for OTP input boxes
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Automatically verify Turnstile widget after rendering
  useEffect(() => {
    if (step === 1 && !isTurnstileVerified && !isTurnstileVerifying) {
      setIsTurnstileVerifying(true)
      const t = setTimeout(() => {
        setIsTurnstileVerified(true)
        setIsTurnstileVerifying(false)
      }, 1800)
      return () => clearTimeout(t)
    }
  }, [step])

  // Scroll to top of card on step change
  useEffect(() => {
    const card = document.querySelector('.auth-card')
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [step])

  // Focus management for OTP
  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return
    const newOtp = [...otp]
    newOtp[index] = value.substring(value.length - 1)
    setOtp(newOtp)

    // Move focus to next input if filled
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp]
      newOtp[index - 1] = ''
      setOtp(newOtp)
      otpRefs.current[index - 1]?.focus()
    }
  }

  // --- Step 1 Action: Request OTP ---
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.warning('Please enter a valid email address.')
      return
    }
    if (!isTurnstileVerified) {
      toast.warning('Security challenge validation in progress.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to send verification code.')
      } else {
        toast.success(data.message || 'OTP verification code sent.')

        setStep(2)
        setResendCooldown(60)
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step 2 Action: Verify OTP ---
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.warning('Please enter the complete 6-digit code.')
      return
    }

    setIsSubmitting(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      })
      const data = await res.json()

      if (!res.ok) {
        setOtpError(data.error || 'Verification failed.')
        toast.error(data.error || 'Verification failed.')
      } else {
        toast.success('Identity verified successfully.')
        setWorkspaceExists(data.workspaceExists)
        setDomain(data.domain)
        if (data.workspaceExists) {
          setExistingOrgId(data.orgId)
          setExistingOrgName(data.orgName)
        } else {
          // Prefill organization name from domain
          const domainPrefix = data.domain.split('.')[0]
          const capitalized = domainPrefix.charAt(0).toUpperCase() + domainPrefix.slice(1)
          setOrgName(capitalized)
        }
        setStep(3)
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step 2 Retry: Resend OTP ---
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to resend code.')
      } else {
        toast.success(data.message || 'New verification code sent.')
        setResendCooldown(60)
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please resend.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step 3 Action (Case A): Finalize New Tenant ---
  const handleFinalizeWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) {
      toast.warning('Organization Name is required.')
      return
    }
    if (!fullName.trim()) {
      toast.warning('Administrator Name is required.')
      return
    }
    if (strengthCount < 3) {
      toast.warning('Password does not satisfy compliance requirements.')
      return
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          orgName,
          password,
          industry: 'Technology',
          compliance,
          llm: llmEngine,
          region
        })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to provision workspace.')
      } else {
        toast.success('Workspace created successfully!')
        router.push(data.redirectUrl || '/command-hub')
      }
    } catch (err) {
      console.error(err)
      toast.error('Deployment request timed out. Retrying context...')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Frictionless Signup Action ---
  const handleFrictionlessSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.warning('Please enter a valid email address.')
      return
    }
    if (!fullName.trim()) {
      toast.warning('Full Name is required.')
      return
    }
    if (strengthCount < 3) {
      toast.warning('Password does not satisfy compliance requirements.')
      return
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          orgName: orgName.trim() || undefined,
          password,
          jobRole: jobRole || undefined,
          industry: 'Technology',
          compliance: 'SOC2',
          llm: 'gemini-2.5-pro',
          region: 'us-east-1'
        })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to provision account.')
      } else {
        toast.success('Account created successfully!')
        router.push(data.redirectUrl || '/command-hub')
      }
    } catch (err) {
      console.error(err)
      toast.error('Deployment request timed out. Retrying...')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step 3 Action (Case B): Submit Access Request ---
  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgId: existingOrgId })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to submit request.')
      } else {
        toast.success('Access request submitted!')
        // Keep screen on success state
        setStep(4)
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!FEATURES.ENTERPRISE_MODE) {
    return (
      <div style={{ background: 'transparent', padding: '0 4px 8px' }}>
        {/* Header */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          {/* 3D Interactive Logo — tracks cursor across the whole page */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Interactive3DLogo size={82} variant="icon" isSubmitting={isSubmitting} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', margin: '12px 0 4px', letterSpacing: '-0.02em' }}>
            Create Your Account
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>
            Start your AegisRAG developer workspace
          </p>
        </div>

        <form onSubmit={handleFrictionlessSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Full Name & Email Row */}
          <div className="form-row-grid">
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Sarah Jenkins"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#090D16',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
                className="auth-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="sarah@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#090D16',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
                className="auth-input"
              />
            </div>
          </div>

          {/* Password & Confirm Password Row */}
          <div className="form-row-grid">
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
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
                  <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} width={15} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
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
                    padding: '10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                  className="auth-input"
                />
                {confirmPassword.length > 0 && (
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: passwordsMatch ? '#10B981' : '#EF4444' }}>
                    <Icon icon={passwordsMatch ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={14} />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Password strength indicator */}
          {password.length > 0 && (
            <div style={{ marginTop: '2px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      height: '2px',
                      borderRadius: '1px',
                      background: s <= strengthCount
                        ? (strengthCount === 4 ? '#10B981' : strengthCount >= 3 ? '#3B82F6' : '#EF4444')
                        : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                <div style={{ fontSize: '0.52rem', color: hasMinLength ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Icon icon={hasMinLength ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                  8+ chars
                </div>
                <div style={{ fontSize: '0.52rem', color: hasUpper ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Icon icon={hasUpper ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                  Uppercase
                </div>
                <div style={{ fontSize: '0.52rem', color: hasNumber ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Icon icon={hasNumber ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                  Number
                </div>
                <div style={{ fontSize: '0.52rem', color: hasSymbol ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Icon icon={hasSymbol ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                  Symbol
                </div>
              </div>
            </div>
          )}

          {/* Optional: Organization & Role Row */}
          <div className="form-row-grid">
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Organization Name <span style={{ color: '#64748B', fontSize: '0.7rem' }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Financial"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#090D16',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
                className="auth-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Your Role <span style={{ color: '#64748B', fontSize: '0.7rem' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 30px 10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                  className="auth-input"
                >
                  <option value="">Select your role...</option>
                  <option value="HR Professional">HR Professional</option>
                  <option value="Recruiter">Recruiter</option>
                  <option value="Professor">Professor</option>
                  <option value="Student">Student</option>
                  <option value="Researcher">Researcher</option>
                  <option value="Cybersecurity Professional">Cybersecurity Professional</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                  <option value="Developer">Developer</option>
                  <option value="Other">Other</option>
                </select>
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  width={14}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
              marginTop: '8px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="btn-finish"
          >
            {isSubmitting ? (
              <>
                <Icon icon="eos-icons:loading" width={16} />
                Creating Trial Account...
              </>
            ) : (
              <>
                Create Account
                <Icon icon="solar:check-circle-bold" width={16} />
              </>
            )}
          </button>
        </form>

        {/* Link to Login */}
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }} className="hover-link">
              Sign In
            </a>
          </p>
        </div>

        <style jsx>{`
          .form-row-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }

          @media (max-width: 480px) {
            .form-row-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }

          :global(.auth-input:focus) {
            border-color: #3B82F6 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
            background: rgba(9, 13, 22, 0.9) !important;
          }

          .btn-finish:hover:not(:disabled) {
            transform: scale(1.015);
            background: linear-gradient(135deg, #5850ec 0%, #4893ff 100%) !important;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35) !important;
          }

          .hover-link:hover {
            text-decoration: underline !important;
            color: #60A5FA !important;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ background: 'transparent', padding: '0 4px 8px' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        {/* 3D Interactive Logo — tracks cursor across the whole page */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <Interactive3DLogo size={82} variant="icon" isSubmitting={isSubmitting} />
        </div>
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#F8FAFC',
            margin: '12px 0 4px',
            letterSpacing: '-0.02em',
          }}
        >
          {step === 4 ? 'Request Sent' : 'Create Workspace'}
        </h3>
        <p style={{ color: '#64748B', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>
          {step === 4 ? 'Awaiting Security Approval' : 'AegisRAG Onboarding Suite'}
        </p>
      </div>

      {/* Premium Step Indicator */}
      {step <= 3 && (
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Step {step} of 3
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>
              {step === 1 && 'Domain Verification'}
              {step === 2 && 'Identity Verification'}
              {step === 3 && (workspaceExists ? 'Workspace Access Discovery' : 'Workspace Configuration')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: s === step
                    ? 'linear-gradient(90deg, #3B82F6, #6366F1)'
                    : s < step
                      ? '#10B981'
                      : 'rgba(255, 255, 255, 0.05)',
                  boxShadow: s === step ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================= STEP 1: EMAIL & DOMAIN CHECK ================= */}
      {step === 1 && (
        <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
              Corporate Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                placeholder="sjenkins@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  width: '100%',
                  padding: '11px 13px 11px 40px',
                  background: '#090D16',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                className="auth-input"
              />
              <Icon
                icon="solar:letter-bold"
                width={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748B'
                }}
              />
            </div>
            <p style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '6px', margin: '6px 0 0 0' }}>
              AegisRAG enforces single tenancy by organization domain. Consumer email addresses are blocked.
            </p>
          </div>

          {/* Simulated Cloudflare Turnstile */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '48px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isTurnstileVerifying && (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(59, 130, 246, 0.2)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                )}
                {isTurnstileVerified && (
                  <Icon icon="solar:check-circle-bold" width={20} style={{ color: '#10B981', animation: 'scaleUp 0.2s ease-out' }} />
                )}
                {!isTurnstileVerified && !isTurnstileVerifying && (
                  <div
                    onClick={() => {
                      setIsTurnstileVerifying(true)
                      setTimeout(() => {
                        setIsTurnstileVerified(true)
                        setIsTurnstileVerifying(false)
                      }, 1000)
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#E2E8F0', fontWeight: 500 }}>
                {isTurnstileVerified ? 'Verification Successful' : 'Verifying secure host signature...'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Icon icon="logos:cloudflare" width={14} />
                <span style={{ fontSize: '0.55rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.02em' }}>turnstile</span>
              </div>
              <span style={{ fontSize: '0.5rem', color: '#475569' }}>Privacy • Terms</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isTurnstileVerified}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#2563EB',
              border: 'none',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: isSubmitting || !isTurnstileVerified ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              opacity: isTurnstileVerified ? 1 : 0.6
            }}
            className="btn-submit"
          >
            {isSubmitting ? (
              <>
                <Icon icon="eos-icons:loading" width={16} />
                Validating domain...
              </>
            ) : (
              <>
                Verify Work Domain
                <Icon icon="solar:arrow-right-bold" width={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* ================= STEP 2: OTP IDENTITY CHECK ================= */}
      {step === 2 && (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '0 0 8px' }}>
              Enter the 6-digit identity validation code sent to:
            </p>
            <p style={{ fontSize: '0.9rem', color: '#3B82F6', fontWeight: 700, margin: 0 }}>
              {email}
            </p>
          </div>

          {/* OTP Box Inputs */}
          <div>
            <div className="otp-container">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpRefs.current[index] = el }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, index)}
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                  style={{
                    border: otpError ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  className="otp-box"
                />
              ))}
            </div>
            {otpError && (
              <p style={{ fontSize: '0.72rem', color: '#EF4444', textAlign: 'center', margin: '4px 0 0' }}>
                {otpError}
              </p>
            )}
          </div>

          {/* Resend Actions */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={resendCooldown > 0 || isSubmitting}
              onClick={handleResendOtp}
              style={{
                background: 'none',
                border: 'none',
                color: resendCooldown > 0 ? '#64748B' : '#3B82F6',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: resendCooldown > 0 || isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Icon icon="solar:restart-bold" width={14} />
              {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '11px 16px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#94A3B8',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              className="btn-back"
            >
              <Icon icon="solar:arrow-left-bold" width={16} />
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '11px 16px',
                background: '#2563EB',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              }}
              className="btn-submit"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="eos-icons:loading" width={16} />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Code
                  <Icon icon="solar:arrow-right-bold" width={16} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ================= STEP 3: WORKSPACE CONFIGURATION (CASE A: NEW TENANT) ================= */}
      {step === 3 && !workspaceExists && (
        <form onSubmit={handleFinalizeWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Org Name */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
              Organization Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Financial"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#090D16',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#F8FAFC',
                fontSize: '0.88rem',
                outline: 'none',
              }}
              className="auth-input"
            />
          </div>

          {/* Admin Full Name */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
              Administrator Name
            </label>
            <input
              type="text"
              required
              placeholder="Sarah Jenkins"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#090D16',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#F8FAFC',
                fontSize: '0.88rem',
                outline: 'none',
              }}
              className="auth-input"
            />
          </div>

          {/* Credentials Row */}
          <div className="form-row-grid">
            {/* Password */}
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
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
                  <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} width={15} />
                </button>
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        style={{
                          flex: 1,
                          height: '2px',
                          borderRadius: '1px',
                          background: s <= strengthCount
                            ? (strengthCount === 4 ? '#10B981' : strengthCount >= 3 ? '#3B82F6' : '#EF4444')
                            : 'rgba(255,255,255,0.03)',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                    <div style={{ fontSize: '0.52rem', color: hasMinLength ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Icon icon={hasMinLength ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                      8+ chars
                    </div>
                    <div style={{ fontSize: '0.52rem', color: hasUpper ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Icon icon={hasUpper ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                      Uppercase
                    </div>
                    <div style={{ fontSize: '0.52rem', color: hasNumber ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Icon icon={hasNumber ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                      Number
                    </div>
                    <div style={{ fontSize: '0.52rem', color: hasSymbol ? '#10B981' : '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Icon icon={hasSymbol ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={7} />
                      Symbol
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '6px' }}>
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
                    padding: '10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                  className="auth-input"
                />
                {confirmPassword.length > 0 && (
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: passwordsMatch ? '#10B981' : '#EF4444' }}>
                    <Icon icon={passwordsMatch ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} width={14} />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Framework & Residency Row */}
          <div className="form-row-grid">
            {/* Select: Framework */}
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '4px' }}>
                Compliance Framework
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={compliance}
                  onChange={(e) => setCompliance(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 30px 10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                  className="auth-input"
                >
                  <option value="SOC2">SOC 2 Type II</option>
                  <option value="ISO27001">ISO 27001</option>
                  <option value="GDPR">GDPR Privacy</option>
                  <option value="HIPAA">HIPAA Compliance</option>
                </select>
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  width={14}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Select: Region */}
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500, marginBottom: '4px' }}>
                Data Residency
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 30px 10px 12px',
                    background: '#090D16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.88rem',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                  className="auth-input"
                >
                  <option value="us-east-1">US East (Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-central-1">EU West (Frankfurt)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </select>
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  width={14}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Step 3 Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: '11px 14px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#94A3B8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              className="btn-back"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '11px 14px',
                background: '#10B981',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              }}
              className="btn-finish"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="eos-icons:loading" width={14} />
                  Deploying Tenant...
                </>
              ) : (
                <>
                  Create Workspace
                  <Icon icon="solar:check-circle-bold" width={14} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ================= STEP 3: WORKSPACE ACCESS REQUEST (CASE B: DOMAIN CONFLICT) ================= */}
      {step === 3 && workspaceExists && (
        <form onSubmit={handleRequestAccess} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', padding: '12px', display: 'flex', gap: '10px' }}>
            <Icon icon="solar:danger-triangle-bold" width={18} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.82rem', color: '#FCA5A5', fontWeight: 700 }}>Domain Isolation Enforced</h4>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#F8FAFC', opacity: 0.8, lineHeight: '1.4' }}>
                An active enterprise tenant already exists for the domain <strong>{domain}</strong>. Creating multiple standalone workspaces for the same domain is restricted.
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.03)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Detected Workspace
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>{existingOrgName}</h3>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{domain}</span>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                <span style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)' }} />
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Plan</span>
                <span style={{ fontSize: '0.75rem', color: '#E2E8F0', fontWeight: 600 }}>Enterprise Dedicated</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Access Mode</span>
                <span style={{ fontSize: '0.75rem', color: '#E2E8F0', fontWeight: 600 }}>Approval Required</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#94A3B8',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              className="btn-back"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '12px 16px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              }}
              className="btn-submit"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="eos-icons:loading" width={16} />
                  Requesting...
                </>
              ) : (
                <>
                  Request Access
                  <Icon icon="solar:user-plus-bold" width={16} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ================= STEP 4: ACCESS REQUEST CONFIRMED STATE ================= */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center', padding: '10px 0' }}>
          <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '50%', transform: 'scale(1.2)', animation: 'pulse-slow 2s infinite' }} />
            <Icon icon="solar:check-circle-bold" width={48} style={{ color: '#10B981' }} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px' }}>Request Pending Approval</h3>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
              Your access request to join the workspace <strong>{existingOrgName}</strong> has been logged in the audit trail.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '12px 14px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Authorized Email:</span>
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Audit Event:</span>
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>ACCESS_REQUEST</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Status:</span>
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>PENDING_REVIEW</span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
            A system administrator has been notified. You will receive an email once your access is approved.
          </p>

          <button
            type="button"
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: '11px 16px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
            className="btn-back"
          >
            Return to Sign In
          </button>
        </div>
      )}

      {/* Link to Login under form */}
      {step <= 3 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }} className="hover-link">
              Sign In
            </a>
          </p>
        </div>
      )}

      <style jsx>{`
        .form-row-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 12px !important;
        }

        @media (max-width: 480px) {
          .form-row-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

        :global(.auth-input:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
          background: rgba(9, 13, 22, 0.9) !important;
        }

        .otp-container {
          display: flex !important;
          justify-content: center !important;
          gap: 10px !important;
          margin: 12px 0 !important;
        }

        :global(.otp-box) {
          width: 42px !important;
          height: 46px !important;
          text-align: center !important;
          background: #090D16 !important;
          border-radius: 6px !important;
          color: #F8FAFC !important;
          font-size: 1.25rem !important;
          font-weight: bold !important;
          outline: none !important;
          transition: all 0.15s ease !important;
        }

        @media (max-width: 400px) {
          .otp-container {
            gap: 6px !important;
          }
          :global(.otp-box) {
            width: 32px !important;
            height: 38px !important;
            font-size: 1.1rem !important;
          }
        }

        :global(.otp-box:focus) {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
          background: rgba(9, 13, 22, 0.9) !important;
        }
        
        select.auth-input:focus {
          border-color: #3B82F6 !important;
          background: #090D16 !important;
        }

        .btn-submit {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-submit:hover:not(:disabled) {
          transform: scale(1.02);
          background-color: #3B82F6 !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4) !important;
        }
        
        .btn-finish {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-finish:hover:not(:disabled) {
          transform: scale(1.02);
          background-color: #059669 !important;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.4) !important;
        }

        .btn-back {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-back:hover {
          transform: scale(1.02);
          background-color: rgba(255, 255, 255, 0.02) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        .hover-link:hover {
          text-decoration: underline !important;
          color: #60A5FA !important;
        }

        /* 3D Logo Animations */
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes logo-spinY {
          from { transform: perspective(1000px) rotateY(0deg); }
          to { transform: perspective(1000px) rotateY(360deg); }
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.8; transform: scale(1.2); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
