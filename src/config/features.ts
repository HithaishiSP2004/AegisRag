/**
 * Feature Flags Configuration
 */
export const FEATURES = {
  // Toggle between enterprise signup/onboarding and frictionless public trial.
  // When false, signup bypasses OTP, domain restriction, and workspace configuration steps.
  ENTERPRISE_MODE: process.env.NEXT_PUBLIC_ENTERPRISE_MODE === 'true' || false,
}
