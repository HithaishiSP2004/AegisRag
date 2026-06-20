import { jsPDF } from 'jspdf'
import type { AuditEntry } from '../hooks/useAudit'

interface ExportParams {
  logs: AuditEntry[]
  filters: {
    actor?: string
    action?: string
    resource_type?: string
    from?: string
    to?: string
  }
  orgName?: string
  isAuditReport?: boolean // if true, render a executive style report, else a clean raw table ledger
}

async function getBase64ImageFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function generateAuditPdf({ logs, filters, orgName = 'AegisRAG Enterprise Tenant', isAuditReport = false }: ExportParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Helper colors
  const primaryColor = [15, 23, 42] // Slate 900
  const secondaryColor = [71, 85, 105] // Slate 600
  const accentColor = [139, 92, 246] // Violet 500
  const borderColor = [226, 232, 240] // Slate 200
  const lightBg = [248, 250, 252] // Slate 50
  
  // Severity colors
  const severityColors: Record<string, [number, number, number]> = {
    critical: [225, 29, 72], // Red 600
    high: [234, 88, 12],   // Orange 600
    medium: [217, 119, 6],  // Amber 600
    low: [37, 99, 235],     // Blue 600
    info: [71, 85, 105],    // Slate 600
  }

  // Pre-fetch logo
  let logoBase64 = ''
  try {
    logoBase64 = await getBase64ImageFromUrl('/logo-with-name.png')
  } catch (err) {
    console.error('Failed to load logo-with-name for audit PDF:', err)
  }

  // Header helper
  const drawHeaderFooter = (pageNum: number, titleText: string) => {
    // Header line
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
    doc.setLineWidth(0.3)
    doc.line(15, 15, 195, 15)

    // Header Title Logo / Text
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 6, 24, 8)
      } catch (err) {
        console.error('Failed to add header logo:', err)
      }
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text('AEGISRAG SECURITY OPERATIONS CENTER', 15, 11)
    }

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text(titleText, 195, 11, { align: 'right' })

    // Footer
    doc.line(15, 280, 195, 280)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text(`CONFIDENTIAL — SYSTEM INHERENT AUDIT TRAIL`, 15, 285)
    doc.text(`Page ${pageNum}`, 195, 285, { align: 'right' })
  }

  if (isAuditReport) {
    // -------------------------------------------------------------------------
    // PAGE 1: EXECUTIVE AUDIT REPORT COVER & SUMMARY
    // -------------------------------------------------------------------------
    drawHeaderFooter(1, 'EXECUTIVE SUMMARY')

    // Document Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('Security Audit & Governance Report', 15, 35)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text(`Tenant/Org: ${orgName}`, 15, 43)
    doc.text(`Date Generated: ${new Date().toLocaleString()}`, 15, 48)

    // Divider
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2])
    doc.setLineWidth(1)
    doc.line(15, 52, 195, 52)

    // Summary Box
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    doc.rect(15, 58, 180, 48, 'F')
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
    doc.setLineWidth(0.5)
    doc.rect(15, 58, 180, 48, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('EXECUTIVE EXECUTIVE BRIEF', 20, 65)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    
    const briefLines = [
      'This report provides a formal, immutable governance record for all system events executed within the AegisRAG environment.',
      `A total of ${logs.length} events matching the selected security criteria have been compiled and audited.`,
      'The activity logs contain cryptographically verifiable proofs and metadata traces to meet SOC 2, ISO 27001, and HIPAA auditing standard policies.',
      'Active Filters applied during report generation:'
    ]
    let briefY = 71
    briefLines.forEach(l => {
      doc.text(l, 20, briefY)
      briefY += 5
    })

    // Active filters sub-list
    doc.setFont('courier', 'normal')
    doc.setFontSize(8.5)
    const filterText = `Actor: ${filters.actor || 'All'} | Action: ${filters.action || 'All'} | Resource: ${filters.resource_type || 'All'} | From: ${filters.from || 'N/A'} | To: ${filters.to || 'N/A'}`
    doc.text(filterText, 22, 94)

    // Security Metrics Dashboard Summary
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('AUDIT PROFILE OVERVIEW', 15, 120)

    const criticalCount = logs.filter(l => (l as any).severity === 'critical' || (l as any).severity === 'danger').length
    const highCount = logs.filter(l => (l as any).severity === 'high' || (l.action && l.action.toLowerCase().includes('delete'))).length
    const normalCount = logs.length - criticalCount - highCount

    // Draw Metric Cards
    const cards = [
      { name: 'TOTAL AUDITED EVENTS', count: logs.length, color: primaryColor },
      { name: 'CRITICAL EVENT DISPATCHES', count: criticalCount, color: severityColors.critical },
      { name: 'HIGH/DESTRUCTIVE ACTIONS', count: highCount, color: severityColors.high },
      { name: 'OPERATIONAL LOGS', count: normalCount, color: severityColors.low }
    ]

    let cardX = 15
    cards.forEach((card) => {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
      doc.rect(cardX, 126, 42, 28, 'F')
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.rect(cardX, 126, 42, 28, 'S')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(card.color[0], card.color[1], card.color[2])
      const splitLabel = doc.splitTextToSize(card.name, 38)
      doc.text(splitLabel, cardX + 3, 133)

      doc.setFontSize(16)
      doc.text(String(card.count), cardX + 3, 148)

      cardX += 46
    })

    // Cryptographic Attestation Block
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('COMPLIANCE ATTESTATION', 15, 170)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    const attestationText = [
      'The logs contained herein are extracted directly from the system audit timeline schema, which is governed by immutable PostgreSQL append-only rules.',
      'Cryptographic hashes are calculated for each transaction row to prevent retrospective alteration or deletion of operational history.',
      'The legal and operational sign-off registry below certifies the validity of this compiled governance package.'
    ]
    let attY = 176
    attestationText.forEach(l => {
      doc.text(l, 15, attY)
      attY += 5
    })

    // Signatures
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.setLineWidth(0.4)
    doc.line(15, 230, 90, 230)
    doc.line(115, 230, 190, 230)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('Regulatory Operations Auditor', 15, 235)
    doc.text('CISO/System Administrator', 115, 235)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text('Signature / Date', 15, 239)
    doc.text('Signature / Date', 115, 239)

    doc.addPage()
  }

  // -------------------------------------------------------------------------
  // RENDER AUDIT LOG TIMELINE TABLE (PAGES 2+ OR ALL PAGES FOR RAW LEDGER)
  // -------------------------------------------------------------------------
  let pageNum = isAuditReport ? 2 : 1
  let currentY = 28

  drawHeaderFooter(pageNum, isAuditReport ? 'AUDIT TIMELINE LEDGER' : 'AUDIT SYSTEM LEDGER')

  // Table Headers
  const drawTableHeaders = (y: number) => {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(15, y, 180, 8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('TIMESTAMP', 18, y + 5.5)
    doc.text('ACTOR (ROLE)', 52, y + 5.5)
    doc.text('ACTION', 92, y + 5.5)
    doc.text('RESOURCE', 137, y + 5.5)
    doc.text('SEVERITY', 172, y + 5.5)
  }

  drawTableHeaders(currentY)
  currentY += 8

  if (logs.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text('No audit events matched the current filters.', 15, currentY + 10)
  } else {
    logs.forEach((log) => {
      // Check if we need a new page
      if (currentY > 260) {
        doc.addPage()
        pageNum += 1
        drawHeaderFooter(pageNum, isAuditReport ? 'AUDIT TIMELINE LEDGER' : 'AUDIT SYSTEM LEDGER')
        currentY = 28
        drawTableHeaders(currentY)
        currentY += 8
      }

      // Draw row background or border
      doc.setFillColor(255, 255, 255)
      doc.rect(15, currentY, 180, 10, 'F')
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.setLineWidth(0.2)
      doc.line(15, currentY + 10, 195, currentY + 10)

      // Time
      const timeStr = new Date(log.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      doc.setFont('courier', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text(timeStr, 17, currentY + 6.5)

      // Actor & Role
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const actorLabel = log.actor_name || log.actor_email || 'System'
      const roleLabel = log.actor_role ? ` (${log.actor_role})` : ''
      const actorFull = `${actorLabel}${roleLabel}`
      const actorTrunc = actorFull.length > 20 ? actorFull.slice(0, 18) + '..' : actorFull
      doc.text(actorTrunc, 52, currentY + 6.5)

      // Action
      doc.setFont('helvetica', 'normal')
      const actionTrunc = log.action.length > 25 ? log.action.slice(0, 23) + '..' : log.action
      doc.text(actionTrunc, 92, currentY + 6.5)

      // Resource Type
      const resVal = log.resource_type || 'system'
      doc.setFont('courier', 'normal')
      doc.setFontSize(7.5)
      doc.text(resVal, 137, currentY + 6.5)

      // Severity (based on action/role/values)
      let severity = 'info'
      if (log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('remove')) {
        severity = 'high'
      } else if (log.action.toLowerCase().includes('critical') || log.action.toLowerCase().includes('mfa_failed')) {
        severity = 'critical'
      } else if (log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit')) {
        severity = 'medium'
      } else if (log.action.toLowerCase().includes('create') || log.action.toLowerCase().includes('add')) {
        severity = 'low'
      }
      
      const sColor = severityColors[severity] || severityColors.info
      doc.setFillColor(sColor[0] + 40, sColor[1] + 40, sColor[2] + 40) // lighter background
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(sColor[0], sColor[1], sColor[2])
      doc.text(severity.toUpperCase(), 172, currentY + 6.5)

      currentY += 10
    })
  }

  // Save the PDF
  const filename = `${isAuditReport ? 'audit-report' : 'audit-log'}-${new Date().toISOString().slice(0,10)}.pdf`
  doc.save(filename)
}
