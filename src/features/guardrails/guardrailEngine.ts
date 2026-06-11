import crypto from 'crypto'

export type GuardrailSeverity = 'ALLOW' | 'WARN' | 'BLOCK'

export interface InputGuardResult {
  prompt_hash: string
  categories: string[]
  risk_score: number
  severity: GuardrailSeverity
  action: 'allowed' | 'warned' | 'blocked'
  metadata: {
    detected_pii?: string[]
    injections_detected?: string[]
    jailbreaks_detected?: string[]
    security_risk_detected?: string[]
    prompt_leakage_detected?: string[]
  }
}

/**
 * Computes a SHA-256 hash of the input prompt for safe, privacy-compliant audit logging.
 */
export function computePromptHash(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex')
}

// Regular expressions for PII detection
const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Matches typical international/domestic phone numbers
  PHONE: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
  // SSN: XXX-XX-XXXX
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  // Indian Aadhaar: XXXX XXXX XXXX or XXXX-XXXX-XXXX
  AADHAAR: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
  // Credit Cards (Visa, Mastercard, Amex, etc. 13-19 digits)
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}|\b\d{15,16}\b/g,
  // Common API Keys and Tokens
  API_KEY_OPENAI: /\bsk-[a-zA-Z0-9_-]{32,}\b/g,
  API_KEY_GOOGLE: /\bAIza[a-zA-Z0-9_-]{35}\b/g,
  API_KEY_GITHUB: /\b(?:github_pat_|ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9_]{36,255}\b/g,
  TOKEN_GENERIC: /\b(?:Bearer|jwt) [a-zA-Z0-9\-._~+/]+=*\b/gi
}

// Injections and Jailbreak keyword categories
const INJECTION_PHRASES = [
  'ignore previous instructions',
  'ignore all instructions',
  'reveal system prompt',
  'reveal instructions',
  'disregard policies',
  'bypass safety',
  'act as developer',
  'system override',
  'instruction override',
  'disregard the rules'
]

const JAILBREAK_PHRASES = [
  'dan mode',
  'dan persona',
  'do anything now',
  'role override',
  'act as an unrestricted',
  'jailbreak',
  'bypass model restrictions',
  'you are now free'
]

const PROMPT_LEAKAGE_PHRASES = [
  'show hidden prompt',
  'reveal reasoning',
  'show chain of thought',
  'print your system prompt',
  'what is your prompt',
  'expose instructions'
]

const SECURITY_RISK_PHRASES = [
  'credential extraction',
  'secrets disclosure',
  'internal configuration exposure',
  'reveal credentials',
  'dump database',
  'extract environment variables'
]

/**
 * Scans an input prompt for security violations, PII, and prompt injections.
 * Assigns a risk score from 0-100 and maps to ALLOW, WARN, or BLOCK severity.
 */
export function scanInputPrompt(prompt: string): InputGuardResult {
  const hash = computePromptHash(prompt)
  const categories: string[] = []
  const metadata: InputGuardResult['metadata'] = {}
  
  let maxRisk = 0
  const normalizedPrompt = prompt.toLowerCase()

  // 1. Scan for Prompt Injections (High Risk -> BLOCK)
  const detectedInjections = INJECTION_PHRASES.filter(phrase => 
    normalizedPrompt.includes(phrase)
  )
  if (detectedInjections.length > 0) {
    categories.push('prompt_injection')
    metadata.injections_detected = detectedInjections
    maxRisk = Math.max(maxRisk, 95)
  }

  // 2. Scan for Jailbreak Attempts (High Risk -> BLOCK)
  const detectedJailbreaks = JAILBREAK_PHRASES.filter(phrase => 
    normalizedPrompt.includes(phrase)
  )
  if (detectedJailbreaks.length > 0) {
    categories.push('jailbreak')
    metadata.jailbreaks_detected = detectedJailbreaks
    maxRisk = Math.max(maxRisk, 98)
  }

  // 3. Scan for Prompt Leakage Requests (High Risk -> BLOCK)
  const detectedLeakage = PROMPT_LEAKAGE_PHRASES.filter(phrase => 
    normalizedPrompt.includes(phrase)
  )
  if (detectedLeakage.length > 0) {
    categories.push('prompt_leakage')
    metadata.prompt_leakage_detected = detectedLeakage
    maxRisk = Math.max(maxRisk, 92)
  }

  // 4. Scan for Sensitive Security Risks (High Risk -> BLOCK)
  const detectedSecRisks = SECURITY_RISK_PHRASES.filter(phrase => 
    normalizedPrompt.includes(phrase)
  )
  if (detectedSecRisks.length > 0) {
    categories.push('security_risk')
    metadata.security_risk_detected = detectedSecRisks
    maxRisk = Math.max(maxRisk, 90)
  }

  // 5. Scan for PII and API keys
  const detectedPII: string[] = []

  // Check low/medium risk PII
  if (prompt.match(PII_PATTERNS.EMAIL)) {
    categories.push('pii_email')
    detectedPII.push('EMAIL')
    maxRisk = Math.max(maxRisk, 50)
  }
  if (prompt.match(PII_PATTERNS.PHONE)) {
    categories.push('pii_phone')
    detectedPII.push('PHONE')
    maxRisk = Math.max(maxRisk, 45)
  }
  if (prompt.match(PII_PATTERNS.SSN)) {
    categories.push('pii_ssn')
    detectedPII.push('SSN')
    maxRisk = Math.max(maxRisk, 75)
  }
  if (prompt.match(PII_PATTERNS.AADHAAR)) {
    categories.push('pii_aadhaar')
    detectedPII.push('AADHAAR')
    maxRisk = Math.max(maxRisk, 70)
  }
  if (prompt.match(PII_PATTERNS.CREDIT_CARD)) {
    categories.push('pii_credit_card')
    detectedPII.push('CREDIT_CARD')
    maxRisk = Math.max(maxRisk, 80)
  }

  // Check high risk API keys/credentials (BLOCK)
  let apiKeysDetected = false
  if (prompt.match(PII_PATTERNS.API_KEY_OPENAI)) {
    categories.push('credential_openai')
    detectedPII.push('API_KEY_OPENAI')
    apiKeysDetected = true
  }
  if (prompt.match(PII_PATTERNS.API_KEY_GOOGLE)) {
    categories.push('credential_google')
    detectedPII.push('API_KEY_GOOGLE')
    apiKeysDetected = true
  }
  if (prompt.match(PII_PATTERNS.API_KEY_GITHUB)) {
    categories.push('credential_github')
    detectedPII.push('API_KEY_GITHUB')
    apiKeysDetected = true
  }
  if (prompt.match(PII_PATTERNS.TOKEN_GENERIC)) {
    categories.push('credential_generic')
    detectedPII.push('TOKEN_GENERIC')
    apiKeysDetected = true
  }

  if (detectedPII.length > 0) {
    metadata.detected_pii = detectedPII
    if (apiKeysDetected) {
      maxRisk = Math.max(maxRisk, 91)
    }
  }

  // Determine severity and action taken based on final risk score
  let severity: GuardrailSeverity = 'ALLOW'
  let action: 'allowed' | 'warned' | 'blocked' = 'allowed'

  if (maxRisk >= 90) {
    severity = 'BLOCK'
    action = 'blocked'
  } else if (maxRisk >= 40) {
    severity = 'WARN'
    action = 'warned'
  }

  return {
    prompt_hash: hash,
    categories,
    risk_score: maxRisk,
    severity,
    action,
    metadata
  }
}
