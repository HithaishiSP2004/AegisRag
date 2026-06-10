/**
 * AegisRAG Enterprise Email Service
 * Powered by Resend API (Direct REST Integration)
 */

interface SendEmailParams {
  to: string[] | string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to]
  const isDev = process.env.NODE_ENV === 'development'

  let targetRecipients = recipients
  let finalHtml = html

  if (isDev) {
    targetRecipients = ['hithusp2@gmail.com']
    const originalRecipientStr = recipients.join(', ')

    // Log redirection details as requested
    console.log(`[EMAIL DEV MODE]\nOriginal Recipient: ${originalRecipientStr}\nRedirected To: hithusp2@gmail.com`)

    // Prepend original recipient information to the top of the email
    const devBadge = `
      <div style="background-color: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 12px; margin-bottom: 24px; border-radius: 8px; font-family: monospace; font-size: 14px; color: #ffffff;">
        <strong>Original Recipient:</strong><br/>
        ${originalRecipientStr}
      </div>
    `
    // Inject right after the body tag opens
    const bodyMatch = finalHtml.match(/<body[^>]*>/i)
    if (bodyMatch) {
      const insertIndex = bodyMatch.index! + bodyMatch[0].length
      finalHtml = finalHtml.slice(0, insertIndex) + '\n' + devBadge + finalHtml.slice(insertIndex)
    } else {
      finalHtml = devBadge + finalHtml
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[EMAIL WARNING] RESEND_API_KEY is not defined. Email simulated to:', targetRecipients)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AegisRAG Security <onboarding@resend.dev>', // Fallback sender address for Resend sandbox testing
        to: targetRecipients,
        subject: subject,
        html: finalHtml,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[EMAIL ERROR] Resend API responded with error:', errorText)
      return false
    }

    const data = await res.json()
    console.log('[EMAIL SUCCESS] Email sent via Resend:', data.id)
    return true
  } catch (err) {
    console.error('[EMAIL EXCEPTION] Failed to dispatch email:', err)
    return false
  }
}

/**
 * Base template styling variables
 */
const darkThemeStyles = `
  background-color: #030712;
  color: #f3f4f6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  margin: 0;
  padding: 40px 20px;
`

const containerStyles = `
  max-width: 580px;
  margin: 0 auto;
  background-color: #0b0f19;
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
`

const headerLogoStyles = `
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
`

const logoBoxStyles = `
  width: 36px;
  height: 36px;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1.5px solid #3b82f6;
  border-radius: 8px;
  display: inline-block;
  vertical-align: middle;
  text-align: center;
  line-height: 34px;
`

const brandTextStyles = `
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.025em;
  display: inline-block;
  vertical-align: middle;
  margin-left: 10px;
`

const titleStyles = `
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
  margin-top: 0;
  margin-bottom: 16px;
`

const textStyles = `
  color: #9ca3af;
  font-size: 15px;
  line-height: 1.625;
  margin-top: 0;
  margin-bottom: 24px;
`

const otpBoxStyles = `
  background-color: rgba(59, 130, 246, 0.05);
  border: 1.5px dashed rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: #3b82f6;
  margin: 32px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
`

const badgeStyles = `
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
`

const buttonStyles = `
  display: inline-block;
  background-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 8px;
  margin: 24px 0;
  text-align: center;
`

const dividerStyles = `
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 32px 0 24px;
`

const footerStyles = `
  font-size: 12px;
  color: #4b5563;
  line-height: 1.5;
`

/**
 * 1. Template: OTP Verification Code
 */
export function getOtpEmailTemplate(otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Verify your AegisRAG Identity</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Identity Verification</span>
          </div>

          <h2 style="${titleStyles}">Verification Code</h2>
          <p style="${textStyles}">
            You are initiating the authentication and workspace setup process on AegisRAG. Please use the secure authorization code below to verify your corporate email identity.
          </p>

          <div style="${otpBoxStyles}">${otp}</div>

          <p style="${textStyles}">
            This verification code is active for <strong>10 minutes</strong> and is restricted to single-use validation. If you did not request this identity verification, please notify your internal compliance officer immediately.
          </p>

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}

/**
 * 2. Template: Access Request Admin Notification
 */
export function getAccessRequestEmailTemplate(userEmail: string, orgName: string, approvalLink?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>New Access Request - AegisRAG</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Access Gate</span>
          </div>

          <h2 style="${titleStyles}">Action Required: Access Request</h2>
          <p style="${textStyles}">
            A new team member is requesting authorization to join the <strong>${orgName}</strong> enterprise workspace.
          </p>

          <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Requestor Email:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${userEmail}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Destination Workspace:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${orgName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px;">Policy Group:</td>
                <td style="color: #3b82f6; font-size: 14px; font-weight: 600;">Domain Ownership Auto-Check Passed</td>
              </tr>
            </table>
          </div>

          <p style="${textStyles}">
            Please log into the AegisRAG Security Operations Center to review, configure role permissions, and approve or reject this request.
          </p>

          ${approvalLink ? `
            <div style="text-align: center;">
              <a href="${approvalLink}" style="${buttonStyles}">Review Access Request</a>
            </div>
          ` : ''}

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}

/**
 * 3. Template: Welcome Workspace Provisioned
 */
export function getWorkspaceCreatedEmailTemplate(fullName: string, orgName: string, domain: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Welcome to AegisRAG</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Workspace Active</span>
          </div>

          <h2 style="${titleStyles}">Workspace Successfully Provisioned</h2>
          <p style="${textStyles}">
            Hello ${fullName},<br><br>
            Your enterprise tenant workspace for <strong>${orgName}</strong> is fully active and initialized. The system has applied default governance policies, role configurations, and compliance rules.
          </p>

          <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Workspace Name:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${orgName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Primary Domain:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${domain}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px;">Super Administrator:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600;">${fullName}</td>
              </tr>
            </table>
          </div>

          <p style="${textStyles}">
            You can now invite members, connect enterprise knowledge sources, and configure retrieval guardrails.
          </p>

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://aegisrag.com'}/command-hub" style="${buttonStyles}">Access Command Hub</a>
          </div>

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}

/**
 * 4. Template: Password Reset Link
 */
export function getPasswordResetEmailTemplate(resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Reset your AegisRAG Password</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Password Recovery</span>
          </div>

          <h2 style="${titleStyles}">Password Reset Request</h2>
          <p style="${textStyles}">
            We received a request to reset the password for your AegisRAG account. Click the button below to establish a new password.
          </p>

          <div style="text-align: center;">
            <a href="${resetLink}" style="${buttonStyles}">Reset Password</a>
          </div>

          <p style="${textStyles}">
            This recovery link is active for <strong>15 minutes</strong>. If you did not initiate this request, you can safely ignore this email; your password will remain secure.
          </p>

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}

/**
 * 5. Template: Upgrade Request Submitted (User Confirmation)
 */
export function getUpgradeRequestSubmittedEmailTemplate(fullName: string, targetTierLabel: string, justification: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Upgrade Request Received - AegisRAG</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Upgrade Pending</span>
          </div>

          <h2 style="${titleStyles}">Upgrade Request Received</h2>
          <p style="${textStyles}">
            Hello ${fullName},<br><br>
            We have successfully received your request to upgrade your workspace status to the <strong>${targetTierLabel}</strong> tier.
          </p>

          <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Requested Tier:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${targetTierLabel}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; vertical-align: top;">Justification:</td>
                <td style="color: #ffffff; font-size: 14px; padding-bottom: 8px; line-height: 1.5;">${justification}</td>
              </tr>
            </table>
          </div>

          <p style="${textStyles}">
            Our administrators are currently reviewing your application. You will receive an automated email notification once your request has been approved or if additional details are required.
          </p>

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}

/**
 * 6. Template: Upgrade Request Admin Notification
 */
export function getUpgradeRequestAdminEmailTemplate(userEmail: string, fullName: string, targetTierLabel: string, justification: string, orgName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aegisrag.com'
  const reviewLink = `${appUrl}/command-hub`
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Upgrade Request Action Required - AegisRAG</title>
      </head>
      <body style="${darkThemeStyles}">
        <div style="${containerStyles}">
          <div style="${headerLogoStyles}">
            <div style="${logoBoxStyles}">
              <span style="color: #3b82f6; font-weight: bold; font-size: 20px;">Æ</span>
            </div>
            <span style="${brandTextStyles}">AegisRAG</span>
            <span style="float: right; margin-top: 8px; ${badgeStyles}">Action Required</span>
          </div>

          <h2 style="${titleStyles}">Action Required: Tier Upgrade Request</h2>
          <p style="${textStyles}">
            A user has requested a tier promotion for their workspace in organization <strong>${orgName}</strong>.
          </p>

          <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">User Name:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${fullName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">User Email:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${userEmail}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Requested Tier:</td>
                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${targetTierLabel}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-size: 14px; vertical-align: top;">Justification:</td>
                <td style="color: #ffffff; font-size: 14px; line-height: 1.5;">${justification}</td>
              </tr>
            </table>
          </div>

          <p style="${textStyles}">
            Please log into the Admin Command Hub to review and approve/reject this tier upgrade request.
          </p>

          <div style="text-align: center;">
            <a href="${reviewLink}" style="${buttonStyles}">Review Upgrade Requests</a>
          </div>

          <hr style="${dividerStyles}">

          <table style="width: 100%; border-spacing: 0;">
            <tr>
              <td style="${footerStyles}">
                <strong>AegisRAG Security Operations</strong><br>
                Enterprise AI Governance & Guardrails<br>
                <span style="color: #374151;">SOC2 Type II • ISO 27001 • HIPAA Ready</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `
}
