import { FEATURES } from '@/config/features'

export interface TierLimits {
  aiRequests: number;
  documentUploads: number;
  storageMb: number;
  pdfExportEnabled: boolean;
  advancedReportingEnabled: boolean;
  complianceSuiteEnabled: boolean;
}

export interface UserUsage {
  aiRequests: number;
  documentUploads: number;
  storageBytes: number;
  totalDocuments?: number;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  trial_user: {
    aiRequests: 10,
    documentUploads: 3,
    storageMb: 5,
    pdfExportEnabled: false,
    advancedReportingEnabled: false,
    complianceSuiteEnabled: false,
  },
  academic_user: {
    aiRequests: 100,
    documentUploads: 25,
    storageMb: 100,
    pdfExportEnabled: true,
    advancedReportingEnabled: false,
    complianceSuiteEnabled: false,
  },
  approved_user: {
    aiRequests: 250,
    documentUploads: 100,
    storageMb: 500,
    pdfExportEnabled: true,
    advancedReportingEnabled: true,
    complianceSuiteEnabled: false,
  },
  enterprise_user: {
    aiRequests: Infinity,
    documentUploads: Infinity,
    storageMb: Infinity,
    pdfExportEnabled: true,
    advancedReportingEnabled: true,
    complianceSuiteEnabled: true,
  }
}

export function isTierRestricted(role: string): boolean {
  if (FEATURES.ENTERPRISE_MODE) {
    return false
  }
  return ['trial_user', 'academic_user', 'approved_user'].includes(role)
}

export function getLimitsForRole(role: string): TierLimits {
  if (role === 'trial_user') return TIER_LIMITS.trial_user
  if (role === 'academic_user') return TIER_LIMITS.academic_user
  if (role === 'approved_user') return TIER_LIMITS.approved_user
  return TIER_LIMITS.enterprise_user
}
