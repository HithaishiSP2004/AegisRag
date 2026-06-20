// =============================================================================
// AegisRAG — Retrieval Query Guardrail & Intent Classifier
// =============================================================================
//
// Purpose:
//   1. SECURITY: Detect and sanitize adversarial retrieval attacks before
//      the query reaches the vector/keyword search layer.
//
//   2. ACCURACY: Classify query intent so the retrieval pipeline applies
//      the correct strategy (broad/narrow/standard) and chooses whether
//      to preserve the original query or let Gemini rewrite it.
//
// Attack vectors mitigated:
//   - Vector poisoning via embedded SQL/code injections in query text
//   - Retrieval scope escalation (e.g. cross-tenant org ID leakage)
//   - Regex-DoS (ReDoS) via user-controlled pattern strings
//   - Retrieval prompt injection (hidden instruction override in query)
//   - Data exfiltration via crafted query terms targeting sensitive chunks
//   - Encoding attacks (Unicode homoglyphs, zero-width chars, encoded SQL)
// =============================================================================

import crypto from 'crypto'

export type QueryIntent =
  | 'toc'            // Table of Contents / section listing (broad, document-structural)
  | 'summary'        // Summarize / overview request (broad)
  | 'metadata'       // Author / title / publication details (narrow)
  | 'compliance'     // Compliance framework specific (standard)
  | 'general'        // General grounded Q&A (standard)

export interface QueryGuardResult {
  safe: boolean
  sanitizedQuery: string
  intent: QueryIntent
  shouldPreserveQuery: boolean  // true = don't let Gemini rewrite this query
  attackType: string | null     // null if clean
  riskScore: number             // 0-100
  queryHash: string
}

// =============================================================================
// Attack Pattern Detection
// =============================================================================

/** SQL injection and NoSQL injection patterns in query text */
const SQL_INJECTION_PATTERNS = [
  /'\s*(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,     // ' OR 1=1
  /;\s*(drop|delete|truncate|insert|update|create|alter)\s+/i, // ; DROP TABLE
  /union\s+(all\s+)?select\b/i,                               // UNION SELECT
  /exec\s*\(/i,                                                // exec(
  /xp_cmdshell/i,
  /information_schema/i,
  /pg_sleep/i,                                                 // Postgres timing
  /waitfor\s+delay/i,                                          // MSSQL timing
]

/** Prompt injection specifically targeting the retrieval layer */
const RETRIEVAL_INJECTION_PATTERNS = [
  /\bignore\b.{0,30}\b(previous|all|prior)\b.{0,30}\b(instructions?|context|rules?)\b/i,
  /\bforget\b.{0,30}\b(everything|context|instructions?)\b/i,
  /\bact as\b.{0,20}\b(admin|root|developer|superuser|dba|system)\b/i,
  /\byou are now\b.{0,20}\b(free|unrestricted|unlimited|unfiltered)\b/i,
  /\bbypass\b.{0,30}\b(filter|guard|restriction|policy|security)\b/i,
  /\bshow\b.{0,30}\b(all\s+documents?|every\s+document|other\s+(org|tenant|user))/i,
  /\bsearch\s+across\s+all\s+(org|tenants?|users?|organizations?)\b/i,
]

/** Data exfiltration patterns - queries crafted to extract sensitive system data */
const EXFILTRATION_PATTERNS = [
  /\b(api[_\s-]?key|secret[_\s-]?key|access[_\s-]?token|auth[_\s-]?token)\b/i,
  /\b(password|passwd|pwd)\b.{0,20}\b(for|of|in|to)\b/i,
  /\b(supabase|database)\b.{0,30}\b(credentials?|secrets?|config)\b/i,
  /env(ironment)?\s+(variable|var|config|secret)/i,
  /\b(private|internal|confidential)\b.{0,30}\b(key|token|secret|credential)/i,
]

/** Unicode/encoding evasion attack patterns */
const ENCODING_ATTACK_PATTERNS = [
  /[\u200B-\u200D\uFEFF\u00AD]/,    // Zero-width chars (invisible injection)
  /[\u0400-\u04FF]{3,}/,             // Cyrillic homoglyph cluster
  /(%[0-9a-f]{2}){3,}/i,             // URL-encoded injection sequences
  /\\u00[0-9a-f]{2}/i,               // Unicode escape sequences in plain text
  /&#x?[0-9a-f]+;/i,                 // HTML entity encoding
]

/** ReDoS protection — queries with catastrophic backtracking regex bait */
const MAX_QUERY_LENGTH = 1000
const MAX_WORD_LENGTH = 80      // No legitimate word is >80 chars
const MAX_REPEATED_CHARS = 15   // e.g. "aaaaaaaaaaaaaaaa..." DoS bait

// =============================================================================
// Intent Classification (replaces fragile keyword list)
// =============================================================================

/** Phrases that definitively signal a Table of Contents / structural listing request */
const TOC_PHRASES = [
  'table of contents', 'toc', 'list of sections', 'list of chapters',
  'contents page', 'chapter list', 'section list', 'show sections',
  'what sections', 'what chapters', 'what are the sections', 'what are the chapters',
  'what topics', 'what does it cover', 'list all sections'
]

/** Broad summary intent keywords */
const SUMMARY_KEYWORDS = [
  'summarize', 'summary', 'overview', 'abstract', 'conclusion', 'conclusions',
  'key takeaways', 'takeaways', 'findings', 'results', 'discussion',
  'what is this', 'what does this document', 'what does this paper'
]

/** Narrow metadata-only query terms */
const METADATA_KEYWORDS = [
  'author', 'authors', 'who wrote', 'published by', 'publisher', 'doi',
  'journal', 'conference', 'year published', 'volume', 'issue'
]

/** Phrases that should always be sent to retrieval unchanged (document-specific structural queries) */
const PRESERVE_QUERY_PHRASES = [
  'table of contents', 'toc', 'list of sections', 'list of chapters',
  'summarize this', 'this paper', 'this document', 'this pdf',
  'abstract', 'introduction', 'methodology', 'references section'
]

// =============================================================================
// Core Functions
// =============================================================================

function computeQueryHash(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex').slice(0, 16)
}

/**
 * Sanitizes the query string by removing control characters,
 * trimming excess whitespace, and neutralizing encoding attacks.
 * Does NOT alter semantic content of legitimate queries.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')  // Control characters
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')      // Zero-width chars
    .replace(/\s{2,}/g, ' ')                           // Collapse whitespace
    .trim()
    .slice(0, MAX_QUERY_LENGTH)                        // Length cap
}

/**
 * Classifies the semantic intent of a sanitized query.
 * Returns an intent enum used by the retrieval strategy.
 */
export function classifyIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim()

  // ToC detection — check exact phrases first (highest specificity)
  if (TOC_PHRASES.some(phrase => q.includes(phrase))) {
    return 'toc'
  }

  // Summary/broad detection
  if (SUMMARY_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(q))) {
    return 'summary'
  }

  // Metadata narrow detection — only match if the ENTIRE query is about metadata
  const hasMetadataKw = METADATA_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(q))
  const hasDocumentContext = /\b(document|paper|pdf|report|benchmark|guide|standard)\b/i.test(q)
  if (hasMetadataKw && !hasDocumentContext) {
    return 'metadata'
  }

  // Compliance framework detection
  if (/\b(soc|nist|iso|hipaa|gdpr|pci|cis|owasp|fedramp|cmmc|cobit)\b/i.test(q)) {
    return 'compliance'
  }

  return 'general'
}

/**
 * Determines whether the query should be preserved as-is (not rewritten by Gemini).
 * Document-structural queries must be preserved because rewriting them can strip
 * critical context words like "table of contents", "abstract", etc.
 */
export function shouldPreserveQuery(query: string, intent: QueryIntent): boolean {
  const q = query.toLowerCase().trim()
  if (intent === 'toc' || intent === 'metadata') return true
  if (PRESERVE_QUERY_PHRASES.some(phrase => q.includes(phrase))) return true
  return false
}

/**
 * Main entry point: validates, sanitizes, and classifies a retrieval query.
 * Returns a QueryGuardResult with safe/unsafe verdict and enriched metadata.
 */
export function evaluateRetrievalQuery(rawQuery: string): QueryGuardResult {
  const queryHash = computeQueryHash(rawQuery)

  // ── Length and structural sanity checks ───────────────────────────────────
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return {
      safe: false,
      sanitizedQuery: rawQuery.slice(0, MAX_QUERY_LENGTH),
      intent: 'general',
      shouldPreserveQuery: false,
      attackType: 'QUERY_TOO_LONG',
      riskScore: 60,
      queryHash
    }
  }

  // Detect abnormally long single words (common in ReDoS bait or obfuscation)
  const words = rawQuery.split(/\s+/)
  if (words.some(w => w.length > MAX_WORD_LENGTH)) {
    return {
      safe: false,
      sanitizedQuery: sanitizeQuery(rawQuery),
      intent: 'general',
      shouldPreserveQuery: false,
      attackType: 'ABNORMAL_TOKEN_LENGTH',
      riskScore: 65,
      queryHash
    }
  }

  // Detect repeated character sequences (DoS / bait)
  if (/(.)\1{14,}/.test(rawQuery)) {
    return {
      safe: false,
      sanitizedQuery: sanitizeQuery(rawQuery),
      intent: 'general',
      shouldPreserveQuery: false,
      attackType: 'REPEATED_CHAR_DOS',
      riskScore: 70,
      queryHash
    }
  }

  // ── Encoding attack detection ─────────────────────────────────────────────
  for (const pattern of ENCODING_ATTACK_PATTERNS) {
    if (pattern.test(rawQuery)) {
      return {
        safe: false,
        sanitizedQuery: sanitizeQuery(rawQuery),
        intent: 'general',
        shouldPreserveQuery: false,
        attackType: 'ENCODING_ATTACK',
        riskScore: 85,
        queryHash
      }
    }
  }

  // ── SQL injection detection ───────────────────────────────────────────────
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(rawQuery)) {
      return {
        safe: false,
        sanitizedQuery: sanitizeQuery(rawQuery),
        intent: 'general',
        shouldPreserveQuery: false,
        attackType: 'SQL_INJECTION',
        riskScore: 95,
        queryHash
      }
    }
  }

  // ── Retrieval prompt injection detection ──────────────────────────────────
  for (const pattern of RETRIEVAL_INJECTION_PATTERNS) {
    if (pattern.test(rawQuery)) {
      return {
        safe: false,
        sanitizedQuery: sanitizeQuery(rawQuery),
        intent: 'general',
        shouldPreserveQuery: false,
        attackType: 'RETRIEVAL_INJECTION',
        riskScore: 95,
        queryHash
      }
    }
  }

  // ── Data exfiltration detection ───────────────────────────────────────────
  for (const pattern of EXFILTRATION_PATTERNS) {
    if (pattern.test(rawQuery)) {
      return {
        safe: false,
        sanitizedQuery: sanitizeQuery(rawQuery),
        intent: 'general',
        shouldPreserveQuery: false,
        attackType: 'DATA_EXFILTRATION',
        riskScore: 90,
        queryHash
      }
    }
  }

  // ── All checks passed — sanitize and classify ─────────────────────────────
  const sanitizedQuery = sanitizeQuery(rawQuery)
  const intent = classifyIntent(sanitizedQuery)
  const preserve = shouldPreserveQuery(sanitizedQuery, intent)

  return {
    safe: true,
    sanitizedQuery,
    intent,
    shouldPreserveQuery: preserve,
    attackType: null,
    riskScore: 0,
    queryHash
  }
}
