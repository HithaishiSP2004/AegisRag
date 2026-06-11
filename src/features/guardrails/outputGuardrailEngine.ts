export interface OutputGuardSource {
  chunkId: string
  content: string
  source_doc?: string
  page_number?: number
}

export interface OutputGuardResult {
  groundedness_score: number // 0-100
  confidence: 'Low' | 'Medium' | 'High'
  risk_score: number // 0-100
  severity: 'ALLOW' | 'WARN' | 'BLOCK'
  action: 'allowed' | 'warned' | 'blocked'
  categories: string[]
  metadata: {
    total_citations: number
    valid_citations: number
    invalid_citations: number
    fabricated_citations_detected: boolean
    hallucination_detected: boolean
    unsupported_claims_count: number
    citation_health_pct: number
  }
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'this', 'that', 'these', 'those', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
  'according', 'context', 'provided', 'retrieved', 'document', 'documents', 'policy', 'policies', 'information', 'source', 'sources', 'based', 'stated', 'states', 'mention', 'mentions', 'find', 'found', 'says', 'say', 'reference', 'references', 'guidelines', 'guideline', 'requirements', 'requirement', 'section', 'sections', 'page', 'pages', 'paragraph'
])

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
  
  const tokens = new Set<string>()
  for (const word of words) {
    if (word.length >= 3 && !STOPWORDS.has(word)) {
      tokens.add(word)
    }
  }
  return tokens
}

function calculateJaccardOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0
  let intersectionCount = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++
    }
  }
  const unionCount = setA.size + setB.size - intersectionCount
  return intersectionCount / unionCount
}

function calculateContainmentOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0) return 0
  let intersectionCount = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++
    }
  }
  return intersectionCount / setA.size
}

/**
 * Validates output text against a list of retrieved reference sources.
 * Checks for groundedness, citation validity, and hallucinated claims.
 */
export function scanOutputResponse(
  answer: string,
  sources: OutputGuardSource[]
): OutputGuardResult {
  const categories: string[] = []
  const metadata = {
    total_citations: 0,
    valid_citations: 0,
    invalid_citations: 0,
    fabricated_citations_detected: false,
    hallucination_detected: false,
    unsupported_claims_count: 0,
    citation_health_pct: 100
  }

  if (sources.length === 0) {
    return {
      groundedness_score: 0,
      confidence: 'High',
      risk_score: 0,
      severity: 'ALLOW',
      action: 'allowed',
      categories: [],
      metadata
    }
  }

  // 1. Detect if the answer indicates insufficient evidence
  const answerLower = answer.toLowerCase()
  const hasInsufficientEvidenceKeyword = 
    answer.includes('INSUFFICIENT_EVIDENCE') || 
    answerLower.includes('insufficient evidence') ||
    answerLower.includes('do not have enough information') ||
    answerLower.includes('no documents found') ||
    answerLower.includes('cannot find') ||
    answerLower.includes('not mentioned in the provided documents')

  if (hasInsufficientEvidenceKeyword) {
    // Model correctly identified lack of evidence; no hallucination
    return {
      groundedness_score: 100,
      confidence: 'High',
      risk_score: 0,
      severity: 'ALLOW',
      action: 'allowed',
      categories: [],
      metadata
    }
  }

  // 2. Parse inline citations [N]
  const citationRegex = /\[(\d+)\]/g
  let match
  const citationIndices: number[] = []
  while ((match = citationRegex.exec(answer)) !== null) {
    citationIndices.push(parseInt(match[1], 10))
  }

  metadata.total_citations = citationIndices.length

  // Validate citations
  const uniqueCitations = Array.from(new Set(citationIndices))
  let validCount = 0
  let invalidCount = 0

  for (const index of uniqueCitations) {
    // Sources are 0-indexed, citations [N] are 1-indexed
    if (index >= 1 && index <= sources.length) {
      validCount++
    } else {
      invalidCount++
    }
  }

  // Update citation counts based on total occurrences of valid/invalid indices
  let totalValidCitations = 0
  let totalInvalidCitations = 0
  for (const index of citationIndices) {
    if (index >= 1 && index <= sources.length) {
      totalValidCitations++
    } else {
      totalInvalidCitations++
    }
  }

  metadata.valid_citations = totalValidCitations
  metadata.invalid_citations = totalInvalidCitations
  metadata.citation_health_pct = metadata.total_citations > 0 
    ? Math.round((totalValidCitations / metadata.total_citations) * 100)
    : 100

  if (totalInvalidCitations > 0) {
    metadata.fabricated_citations_detected = true
    metadata.hallucination_detected = true
    categories.push('fabricated_citation')
  }

  // Check for citation spam (>12 total citations)
  if (metadata.total_citations > 12) {
    metadata.hallucination_detected = true
    categories.push('citation_spam')
  }

  // 3. Groundedness Evaluation
  // Tokenize the full answer and overall sources
  const answerTokens = tokenize(answer)
  const combinedSourcesText = sources.map(s => s.content).join(' ')
  const sourcesTokens = tokenize(combinedSourcesText)

  const keywordOverlap = calculateContainmentOverlap(answerTokens, sourcesTokens)

  // Split answer into sentences to check local groundedness
  // Matches periods/exclamations followed by space and capital letters
  const sentences = answer
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 10)

  let citedSentencesCount = 0
  let sentenceGroundednessSum = 0

  for (const sentence of sentences) {
    const sentenceCitations: number[] = []
    let sentenceMatch
    const sentenceRegex = /\[(\d+)\]/g
    while ((sentenceMatch = sentenceRegex.exec(sentence)) !== null) {
      sentenceCitations.push(parseInt(sentenceMatch[1], 10))
    }

    const sentenceTokens = tokenize(sentence)

    if (sentenceCitations.length > 0) {
      citedSentencesCount++
      let sentenceOverlapMax = 0
      
      // Calculate max overlap with any of the referenced sources in this sentence
      for (const citeIndex of sentenceCitations) {
        if (citeIndex >= 1 && citeIndex <= sources.length) {
          const sourceText = sources[citeIndex - 1].content
          const sourceTokens = tokenize(sourceText)
          const overlap = calculateContainmentOverlap(sentenceTokens, sourceTokens)
          if (overlap > sentenceOverlapMax) {
            sentenceOverlapMax = overlap
          }
        }
      }
      sentenceGroundednessSum += sentenceOverlapMax
    } else {
      // Uncited sentence: calculate overlap with all sources to see if it is still grounded
      const generalOverlap = calculateContainmentOverlap(sentenceTokens, sourcesTokens)
      if (generalOverlap < 0.1) {
        metadata.unsupported_claims_count++
      }
    }
  }

  const averageSentenceGroundedness = citedSentencesCount > 0
    ? (sentenceGroundednessSum / citedSentencesCount)
    : keywordOverlap

  // Composite Groundedness Score (0-100)
  // Weighted: 35% overall keyword overlap, 65% sentence-level citation overlap
  let groundednessScore = Math.round(
    (0.35 * keywordOverlap + 0.65 * averageSentenceGroundedness) * 100
  )

  // Boost groundedness if no claims are unsupported and overlap is healthy
  if (metadata.unsupported_claims_count === 0 && groundednessScore > 40) {
    groundednessScore = Math.min(100, groundednessScore + 10)
  }

  // Cap groundedness if sources exist but no citations are present in a detailed answer
  if (sources.length > 0 && metadata.total_citations === 0 && answer.length > 200) {
    groundednessScore = Math.min(65, groundednessScore)
    categories.push('missing_citations')
  }

  // Penalize for fabricated citations or hallucinated controls
  if (metadata.fabricated_citations_detected) {
    groundednessScore = Math.max(20, groundednessScore - 40)
  }

  if (metadata.unsupported_claims_count > 2) {
    metadata.hallucination_detected = true
    categories.push('unsupported_claims')
  }

  // Ensure bounded score
  groundednessScore = Math.max(0, Math.min(100, groundednessScore))

  // 4. Action thresholds
  // Groundedness >= 80 -> ALLOW
  // Groundedness 60-79 -> WARN
  // Groundedness < 60 -> BLOCK
  let severity: 'ALLOW' | 'WARN' | 'BLOCK' = 'ALLOW'
  let action: 'allowed' | 'warned' | 'blocked' = 'allowed'
  let riskScore = Math.round(100 - groundednessScore)

  if (groundednessScore < 60) {
    severity = 'BLOCK'
    action = 'blocked'
    riskScore = Math.max(riskScore, 70) // Ensure clear block risk
  } else if (groundednessScore < 80) {
    severity = 'WARN'
    action = 'warned'
    riskScore = Math.max(riskScore, 40) // Ensure clear warn risk
  }

  // Determine confidence
  let confidence: 'Low' | 'Medium' | 'High' = 'High'
  if (groundednessScore < 60) {
    confidence = 'Low'
  } else if (groundednessScore < 80) {
    confidence = 'Medium'
  }

  console.log('[governance]', {
    retrievedChunks: sources.length,
    citationCount: metadata.total_citations,
    groundednessScore,
    severity,
    categories,
  })

  console.log('[governance overlap]', {
    keywordOverlap,
    averageSentenceGroundedness,
    unsupportedClaims: metadata.unsupported_claims_count,
  })

  return {
    groundedness_score: groundednessScore,
    confidence,
    risk_score: riskScore,
    severity,
    action,
    categories,
    metadata
  }
}

export function cleanCitations(text: string): string {
  // Collapse duplicate consecutive citation markers, e.g. [1] [1] or [1][1] -> [1]
  let cleaned = text.replace(/(\[\d+\])(?:\s*\1)+/g, '$1')

  // Enforce maximum citations per paragraph (max 4)
  const paragraphs = cleaned.split(/\n\s*\n/)
  const MAX_CITATIONS_PER_PARAGRAPH = 4

  const processedParagraphs = paragraphs.map(p => {
    let count = 0
    return p.replace(/\[(\d+)\]/g, (match) => {
      count++
      return count <= MAX_CITATIONS_PER_PARAGRAPH ? match : ''
    })
  })
  cleaned = processedParagraphs.join('\n\n')

  // Enforce maximum total citations (max 8)
  const MAX_TOTAL_CITATIONS = 8
  let totalCount = 0
  cleaned = cleaned.replace(/\[(\d+)\]/g, (match) => {
    totalCount++
    return totalCount <= MAX_TOTAL_CITATIONS ? match : ''
  })

  // Clean trailing spaces
  return cleaned.replace(/ {2,}/g, ' ')
}
