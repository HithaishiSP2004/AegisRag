// =============================================================================
// AegisRAG App-Wide Constants
// =============================================================================

export const APP_CONFIG = {
  name: 'AegisRAG',
  tagline: 'Trust Every Decision',
  version: '1.0.0',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const

// Demo organization seeded in Supabase
export const DEMO_ORG = {
  name: 'AegisRAG Demo Corp',
  slug: 'aegisrag-demo',
} as const

// Demo user credentials (for development/demo only)
export const DEMO_USERS = {
  admin: 'admin@aegisdemo.com',
  compliance: 'compliance@aegisdemo.com',
  auditor: 'auditor@aegisdemo.com',
} as const

// User roles (must match DB enum)
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPLIANCE_OFFICER: 'compliance_officer',
  SECURITY_ANALYST: 'security_analyst',
  AUDITOR: 'auditor',
  EXECUTIVE: 'executive',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// Document types (must match DB enum)
export const DOC_TYPES = {
  HR_POLICY: 'hr_policy',
  SECURITY_POLICY: 'security_policy',
  COMPLIANCE_MANUAL: 'compliance_manual',
  LEGAL: 'legal',
  VENDOR: 'vendor',
  REGULATORY: 'regulatory',
  OTHER: 'other',
} as const

// Document sensitivity levels (must match DB enum)
export const SENSITIVITY_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  RESTRICTED: 'restricted',
} as const

// Document processing status (must match DB enum)
export const DOC_STATUS = {
  UPLOADING: 'uploading',
  PARSING: 'parsing',
  CHUNKING: 'chunking',
  EMBEDDING: 'embedding',
  INDEXED: 'indexed',
  FAILED: 'failed',
  DELETED: 'deleted',
} as const

// Workflow status (must match DB enum)
export const WORKFLOW_STATUS = {
  PENDING: 'pending',
  RETRIEVING: 'retrieving',
  ANALYZING: 'analyzing',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const

// Violation severity (must match DB enum)
export const VIOLATION_SEVERITY = {
  CRITICAL: 'critical', // weight: 10
  HIGH: 'high', // weight: 7
  MEDIUM: 'medium', // weight: 4
  LOW: 'low', // weight: 1
} as const

// Severity weights for risk scoring
export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 1,
}

// Security event types (must match DB enum)
export const SECURITY_EVENT_TYPES = {
  PROMPT_INJECTION: 'prompt_injection',
  JAILBREAK_ATTEMPT: 'jailbreak_attempt',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  HALLUCINATION_DETECTED: 'hallucination_detected',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  AUTH_FAILURE: 'auth_failure',
} as const

// App routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  AUTH_CALLBACK: '/auth/callback',
  COMMAND_HUB: '/command-hub',
  DASHBOARD: '/dashboard',
  KNOWLEDGE_VAULT: '/knowledge-vault',
  WORKFLOWS: '/workflows',
  REPORTS: '/reports',
  SECURITY: '/security',
  SETTINGS: '/settings',
} as const

// Feature flags
export const FEATURES = {
  ENABLE_3D: process.env.NEXT_PUBLIC_ENABLE_3D === 'true', // Sprint 6 only
  DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === 'true', // Attack simulation panel
} as const
