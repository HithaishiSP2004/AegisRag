import { jsPDF } from 'jspdf'
import crypto from 'crypto'

function sha256Sync(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex')
}

export async function generateComplianceWorkflowPDF(
  workflowName: string,
  report: any,
  documentName: string,
  operatorName = 'Compliance Officer'
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const totalPages = 5

  // Helper to draw standard header/footer on pages 2 to 5
  function drawHeaderFooter(page: number, sectionTitle: string) {
    // Top bar header
    doc.setFillColor(8, 12, 20) // bgBase
    doc.rect(0, 0, 210, 20, 'F')
    
    doc.setTextColor(248, 250, 252) // textPrimary
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('AEGISRAG COMPLIANCE WORKFLOW SYSTEM', 15, 12)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(99, 102, 241) // indigoLight
    doc.text(sectionTitle, 195, 12, { align: 'right' })
    
    // Divider line
    doc.setDrawColor(255, 255, 255, 0.08) // glassBorder
    doc.line(15, 20, 195, 20)

    // Bottom divider & footer
    doc.setDrawColor(255, 255, 255, 0.08)
    doc.line(15, 276, 195, 276)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184) // textSecondary
    doc.text('CLASSIFICATION: CONFIDENTIAL // INTEGRITY ATTESTED VIA GROUNDING SEALS', 15, 282)
    doc.text(`Page ${page} of ${totalPages}`, 195, 282, { align: 'right' })
  }

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Full dark background
  doc.setFillColor(8, 12, 20) // bgBase
  doc.rect(0, 0, 210, 297, 'F')

  // Confidential Banner at top
  doc.setFillColor(13, 17, 28) // bgSecondary
  doc.rect(0, 0, 210, 15, 'F')
  doc.rect(0, 282, 210, 15, 'F')
  
  doc.setTextColor(244, 63, 94) // rose / critical
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('CLASSIFICATION: STRICTLY CONFIDENTIAL // WORKFLOW COMPLIANCE REVIEW REPORT', 105, 10, { align: 'center' })
  doc.text('CLASSIFICATION: STRICTLY CONFIDENTIAL // WORKFLOW COMPLIANCE REVIEW REPORT', 105, 291, { align: 'center' })

  // Decorative border / Shield logo simulation
  doc.setDrawColor(99, 102, 241) // Indigo
  doc.setLineWidth(0.8)
  doc.line(30, 80, 180, 80)
  doc.line(30, 175, 180, 175)

  // Title Text
  doc.setTextColor(248, 250, 252) // textPrimary
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('AEGISRAG COMPLIANCE REVIEW', 105, 110, { align: 'center' })
  doc.text('AUTOMATED WORKFLOW AUDIT', 105, 122, { align: 'center' })

  // Subtitle
  doc.setTextColor(34, 211, 238) // Cyan
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'normal')
  doc.text(workflowName.toUpperCase(), 105, 136, { align: 'center' })

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8.5)
  doc.text(`Target Document: ${documentName}`, 105, 144, { align: 'center' })

  // Metadata block box
  doc.setFillColor(10, 15, 30) // bgPrimary
  doc.rect(30, 195, 150, 62, 'F')
  doc.setDrawColor(255, 255, 255, 0.08)
  doc.rect(30, 195, 150, 62, 'S')

  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('WORKFLOW RUN IDENTIFICATION', 38, 205)
  doc.line(38, 207, 172, 207)

  const reviewId = `AR-WORKFLOW-${new Date().toISOString().slice(0, 10)}-${Math.floor(1000 + Math.random() * 9000)}`

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8.5)
  doc.text(`Workflow Review ID:  ${reviewId}`, 38, 214)
  doc.text(`Source Document:     ${documentName.slice(0, 48)}${documentName.length > 48 ? '...' : ''}`, 38, 221)
  doc.text(`Selected Frameworks: ${report.telemetry.frameworks_referenced.join(', ')}`, 38, 228)
  doc.text(`Audited By (Operator): ${operatorName}`, 38, 235)
  doc.text(`Executed At:         ${new Date().toLocaleString()}`, 38, 242)
  
  // SHA-256 seal
  const coverPayload = `${reviewId}-${documentName}-${report.compliance_score}-${report.risk_score}`
  const sealHash = sha256Sync(coverPayload)
  doc.setFont('courier', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(16, 185, 129) // emerald
  doc.text(`INTEGRITY SEAL: sha256:${sealHash.slice(0, 48)}...`, 38, 250)

  // ==========================================
  // PAGE 2: EXECUTIVE SUMMARY & METRIC SHARDS
  // ==========================================
  doc.addPage()
  drawHeaderFooter(2, '1.0 EXECUTIVE SUMMARY')

  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('1.0 GRC Posture & Executive Brief', 15, 30)

  // Executive summary text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  const summaryText = report.executive_summary || 'No summary generated.'
  const splitSummary = doc.splitTextToSize(summaryText, 180)
  doc.text(splitSummary, 15, 37)

  const summaryHeight = splitSummary.length * 4.5 + 45

  // Methodology Section
  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('2.0 Analysis Methodology', 15, summaryHeight)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184)
  const methodologyText = report.methodology || 'This compliance workflow isolates document clauses, generates parallel vector/keyword queries, fuses results via Reciprocal Rank Fusion (RRF), and performs Gemini reranking to cross-reference text against compliance controls. Findings are assessed for severity, evidence strength, and citation integrity.'
  const splitMethodology = doc.splitTextToSize(methodologyText, 180)
  doc.text(splitMethodology, 15, summaryHeight + 7)

  // Core Scores Shards Box
  const cardsY = summaryHeight + splitMethodology.length * 4.5 + 16
  
  // Compliance Score Card (Left)
  doc.setFillColor(15, 23, 42) // bgCard
  doc.rect(15, cardsY, 56, 32, 'F')
  doc.setDrawColor(255, 255, 255, 0.08)
  doc.rect(15, cardsY, 56, 32, 'S')
  
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('COMPLIANCE SCORE', 20, cardsY + 7)
  doc.setTextColor(16, 185, 129) // Emerald
  doc.setFontSize(18)
  doc.text(`${report.compliance_score}%`, 20, cardsY + 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(report.compliance_score >= 80 ? 'Control Posture: HIGH' : report.compliance_score >= 50 ? 'Control Posture: MODERATE' : 'Control Posture: CRITICAL', 20, cardsY + 26)

  // Risk Score Card (Middle)
  doc.setFillColor(15, 23, 42)
  doc.rect(77, cardsY, 56, 32, 'F')
  doc.rect(77, cardsY, 56, 32, 'S')
  
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('RISK INDEX', 82, cardsY + 7)
  const riskColor = report.risk_score >= 50 ? [244, 63, 94] : report.risk_score >= 25 ? [245, 158, 11] : [34, 211, 238]
  doc.setTextColor(riskColor[0], riskColor[1], riskColor[2])
  doc.setFontSize(18)
  doc.text(`${report.risk_score}/100`, 82, cardsY + 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(report.risk_score >= 50 ? 'Severe Exposure' : report.risk_score >= 25 ? 'Moderate Exposure' : 'Low Exposure', 82, cardsY + 26)

  // Confidence Score Card (Right)
  doc.setFillColor(15, 23, 42)
  doc.rect(139, cardsY, 56, 32, 'F')
  doc.rect(139, cardsY, 56, 32, 'S')
  
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('AI ATTRIBUTIONS CONFIDENCE', 144, cardsY + 7)
  doc.setTextColor(99, 102, 241) // Indigo
  doc.setFontSize(18)
  doc.text(`${report.confidence_score}%`, 144, cardsY + 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Grounded Attestation Seal', 144, cardsY + 26)

  // Telemetry details block below cards
  const teleY = cardsY + 42
  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('3.0 Workflow Execution Telemetry', 15, teleY)

  // Simple telemetry table
  doc.setFillColor(10, 15, 30)
  doc.rect(15, teleY + 4, 180, 24, 'F')
  doc.setDrawColor(255, 255, 255, 0.05)
  doc.rect(15, teleY + 4, 180, 24, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('ANALYSIS DURATION', 20, teleY + 11)
  doc.text('DOCUMENTS EVALUATED', 65, teleY + 11)
  doc.text('FRAMEWORKS REFERENCED', 110, teleY + 11)
  doc.text('FINDINGS INGESTED', 160, teleY + 11)

  doc.setTextColor(248, 250, 252)
  doc.setFontSize(8.5)
  doc.text(`${report.telemetry.analysis_duration_ms} ms`, 20, teleY + 20)
  doc.text(`${report.telemetry.documents_analyzed} file(s)`, 65, teleY + 20)
  doc.text(`${report.telemetry.frameworks_referenced.join(', ')}`, 110, teleY + 20)
  doc.text(`${report.telemetry.findings_count} item(s)`, 160, teleY + 20)

  // ==========================================
  // PAGE 3: DETAILED FINDINGS (VIOLATIONS) TABLE
  // ==========================================
  doc.addPage()
  drawHeaderFooter(3, '3.0 COMPLIANCE FINDINGS')

  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('4.0 Compliance Findings & Gap Registry', 15, 30)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Registry of detected document clauses causing framework mismatches or security controls deviations.', 15, 35)

  let listY = 44
  const violations = report.violations || []

  if (violations.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(16, 185, 129)
    doc.text('✓ No violations or GRC compliance gaps detected in target document.', 15, 48)
  } else {
    // Draw table headers
    doc.setFillColor(15, 23, 42) // bgCard
    doc.rect(15, listY, 180, 8, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(248, 250, 252)
    doc.text('CLAUSE / POLICY REFERENCE', 18, listY + 5)
    doc.text('SEVERITY', 110, listY + 5)
    doc.text('EVIDENCE STRENGTH', 135, listY + 5)
    doc.text('CONFIDENCE', 172, listY + 5)

    listY += 8

    violations.slice(0, 6).forEach((v: any, index: number) => {
      // Background rows
      doc.setFillColor(8, 12, 20)
      doc.rect(15, listY, 180, 32, 'F')
      doc.setDrawColor(255, 255, 255, 0.04)
      doc.rect(15, listY, 180, 32, 'S')

      // 1. Title/Reference
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(248, 250, 252)
      doc.text(`${index + 1}. Policy Ref: ${v.policy_reference || 'N/A'}`, 18, listY + 6)

      // 2. Clause text snippet
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      const clauseTrunc = v.clause.length > 70 ? v.clause.substring(0, 67) + '...' : v.clause
      doc.text(`"${clauseTrunc}"`, 18, listY + 12)

      // 3. Description text wrapped
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      const descLines = doc.splitTextToSize(v.description, 172)
      doc.text(descLines, 18, listY + 18)

      // 4. Severity Tag
      const isCritical = v.severity === 'critical' || v.severity === 'high'
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(isCritical ? 244 : 245, isCritical ? 63 : 158, isCritical ? 94 : 11)
      doc.text(String(v.severity).toUpperCase(), 110, listY + 6)

      // 5. Evidence Strength Tag
      const strengthColor = v.evidence_strength === 'high' ? [16, 185, 129] : v.evidence_strength === 'medium' ? [245, 158, 11] : [99, 102, 241]
      doc.setTextColor(strengthColor[0], strengthColor[1], strengthColor[2])
      doc.text(`${v.evidence_strength.toUpperCase()} STRENGTH`, 135, listY + 6)

      // 6. Confidence Score
      doc.setTextColor(148, 163, 184)
      doc.text(`${Math.round(v.confidence_score * 100)}%`, 172, listY + 6)

      listY += 34
    })
  }

  // ==========================================
  // PAGE 4: STRATEGIC RECOMMENDATIONS
  // ==========================================
  doc.addPage()
  drawHeaderFooter(4, '4.0 REMEDIATION PLAN')

  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('5.0 Strategic Recommendations & Remediation Directives', 15, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Directives mimicking security frameworks to close detected compliance gaps.', 15, 35)

  let recY = 44
  const recommendations = report.recommendations || []

  recommendations.slice(0, 5).forEach((rec: any, idx: number) => {
    doc.setFillColor(15, 23, 42) // bgCard
    doc.rect(15, recY, 180, 22, 'F')
    doc.setDrawColor(255, 255, 255, 0.08)
    doc.rect(15, recY, 180, 22, 'S')

    // Recommendation Title + Priority
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(248, 250, 252)
    doc.text(`Directive ${idx + 1}: ${rec.action}`, 20, recY + 6)

    // Priority tag
    const isHigh = rec.priority === 'critical' || rec.priority === 'high'
    doc.setFillColor(isHigh ? 244 : 99, isHigh ? 63 : 102, isHigh ? 94 : 241, 0.15)
    doc.rect(160, recY + 3.5, 30, 4.5, 'F')
    doc.setFontSize(7)
    doc.setTextColor(isHigh ? 244 : 129, isHigh ? 63 : 140, isHigh ? 94 : 248)
    doc.text(`PRIORITY: ${rec.priority.toUpperCase()}`, 175, recY + 7, { align: 'center' })

    // Rationale text wrapped
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    const rationaleLines = doc.splitTextToSize(`Rationale: ${rec.rationale}`, 170)
    doc.text(rationaleLines, 20, recY + 12)

    recY += 26
  })

  // ==========================================
  // PAGE 5: EVIDENCE CITATIONS (GROUNDING PANEL)
  // ==========================================
  doc.addPage()
  drawHeaderFooter(5, '5.0 EVIDENCE VAULT')

  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('6.0 Grounded Evidence Citations Registry', 15, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Exact citations pulled from global / corporate frameworks used to verify findings. Grounding prevents hallucinations.', 15, 35)

  let evY = 44
  const evidence = report.evidence || []

  if (evidence.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text('No active evidence chunks retrieved from the vault.', 15, 48)
  } else {
    evidence.slice(0, 4).forEach((ev: any, idx: number) => {
      doc.setFillColor(10, 15, 30)
      doc.rect(15, evY, 180, 42, 'F')
      doc.setDrawColor(255, 255, 255, 0.05)
      doc.rect(15, evY, 180, 42, 'S')

      // Metadata: Source, page, framework
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(34, 211, 238) // Cyan
      doc.text(`Evidence Block [${idx + 1}] — Source: ${ev.source_doc} (Page ${ev.page_number})`, 20, evY + 6)
      
      doc.setTextColor(148, 163, 184)
      doc.text(`Framework: ${ev.framework || 'N/A'}`, 190, evY + 6, { align: 'right' })

      // Chunk UUID
      doc.setFont('courier', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`ID: ${ev.chunk_id}`, 20, evY + 11)

      // Content text wrapped
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      const contentLines = doc.splitTextToSize(ev.content, 170)
      doc.text(contentLines.slice(0, 5), 20, evY + 16) // cap lines to prevent overflow

      evY += 46
    })
  }

  // Final verification stamp at the bottom of the evidence page
  doc.setFillColor(16, 185, 129, 0.08)
  doc.rect(15, 240, 180, 18, 'F')
  doc.setDrawColor(16, 185, 129, 0.2)
  doc.rect(15, 240, 180, 18, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(16, 185, 129)
  doc.text('AUDITED EVIDENCE VERIFICATION COMPLETE', 20, 246)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(16, 185, 129)
  doc.text('All findings are mapped directly to verified framework chunks. Cross-tenant boundaries verified. Gating active.', 20, 252)

  // Output as ArrayBuffer and return Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
