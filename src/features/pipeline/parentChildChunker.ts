// =============================================================================
// Phase 4C.6 — Stage 1: Parent-Child Chunker
//
// Implements hierarchical chunking for the parent-child retrieval pipeline.
// Parents are ~2200 chars of broad context; children are ~500 char semantic
// search targets. Only children are ever embedded.
//
// This module is PURE — no side effects, no DB calls, no I/O.
// Safe to unit-test with any string input.
// =============================================================================

// ── Parent tier constants ────────────────────────────────────────────────────
export const PC_PARENT_TARGET  = 1500  // target characters per parent chunk
export const PC_PARENT_MIN     = 1200  // minimum characters (avoid tiny parents)
export const PC_PARENT_MAX     = 1800  // maximum characters (hard ceiling)
export const PC_PARENT_OVERLAP = 200   // overlap between consecutive parent chunks

// ── Child tier constants ─────────────────────────────────────────────────────
export const PC_CHILD_TARGET   = 500   // target characters per child chunk
export const PC_CHILD_MIN      = 400   // minimum characters (avoid tiny children)
export const PC_CHILD_MAX      = 600   // maximum characters (hard ceiling)
export const PC_CHILD_OVERLAP  = 50    // minimal overlap between sibling children

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A single parent-child pair produced from a page's raw text.
 * One parent chunk with N child sub-chunks.
 * Embeddings are generated ONLY for children — never for the parent.
 */
export interface ParentChildPair {
  parentContent: string
  children: string[]
}

/**
 * Summary statistics from a dry-run of the chunker (no DB writes).
 */
export interface ChunkerDryRunStats {
  totalParents: number
  totalChildren: number
  avgChildrenPerParent: number
  minChildrenPerParent: number
  maxChildrenPerParent: number
  avgParentChars: number
  avgChildChars: number
  inputChars: number
}

// ── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Splits raw page text into parent-child chunk pairs.
 *
 * Strategy:
 *   1. Split text into parent windows (~2200 chars) with sentence-boundary alignment.
 *   2. For each parent, sub-split into child windows (~500 chars).
 *   3. Children are fully contained within their parent's text.
 *   4. Children never span parent boundaries.
 *
 * Edge cases:
 *   - Text <= PC_CHILD_MAX: returns one pair where parent === child === text
 *   - Text <= PC_PARENT_MAX but > PC_CHILD_MAX: one parent, multiple children
 *   - Text > PC_PARENT_MAX: multiple parents, each with their own children
 */
export function parentChildChunkText(text: string): ParentChildPair[] {
  if (!text || text.trim().length < 10) return []

  const trimmed = text.trim()

  // Very short text: single parent, single child (identical content)
  if (trimmed.length <= PC_CHILD_MAX) {
    return [{ parentContent: trimmed, children: [trimmed] }]
  }

  // Short enough for one parent, but needs child splitting
  if (trimmed.length <= PC_PARENT_MAX) {
    const children = splitWithSentenceBoundary(
      trimmed, PC_CHILD_TARGET, PC_CHILD_MIN, PC_CHILD_MAX, PC_CHILD_OVERLAP
    )
    return [{ parentContent: trimmed, children }]
  }

  // Full hierarchical split
  const parentChunks = splitWithSentenceBoundary(
    trimmed, PC_PARENT_TARGET, PC_PARENT_MIN, PC_PARENT_MAX, PC_PARENT_OVERLAP
  )

  return parentChunks.map(parent => {
    const children = parent.length <= PC_CHILD_MAX
      ? [parent]
      : splitWithSentenceBoundary(
          parent, PC_CHILD_TARGET, PC_CHILD_MIN, PC_CHILD_MAX, PC_CHILD_OVERLAP
        )
    return { parentContent: parent, children }
  })
}

/**
 * Runs the chunker on a text without writing anything to the database.
 * Returns projection statistics for review before committing a reindex.
 */
export function dryRunChunker(text: string): ChunkerDryRunStats {
  const pairs = parentChildChunkText(text)

  const totalParents = pairs.length
  const totalChildren = pairs.reduce((sum, p) => sum + p.children.length, 0)
  const childCounts = pairs.map(p => p.children.length)
  const parentCharCounts = pairs.map(p => p.parentContent.length)
  const childCharCounts = pairs.flatMap(p => p.children.map(c => c.length))

  return {
    totalParents,
    totalChildren,
    avgChildrenPerParent: totalParents > 0 ? Math.round(totalChildren / totalParents * 10) / 10 : 0,
    minChildrenPerParent: childCounts.length > 0 ? Math.min(...childCounts) : 0,
    maxChildrenPerParent: childCounts.length > 0 ? Math.max(...childCounts) : 0,
    avgParentChars: parentCharCounts.length > 0
      ? Math.round(parentCharCounts.reduce((a, b) => a + b, 0) / parentCharCounts.length)
      : 0,
    avgChildChars: childCharCounts.length > 0
      ? Math.round(childCharCounts.reduce((a, b) => a + b, 0) / childCharCounts.length)
      : 0,
    inputChars: text.trim().length,
  }
}

// ── Internal split helper ─────────────────────────────────────────────────────

/**
 * Splits text into chunks targeting `target` chars, with [min, max] bounds.
 * Prefers sentence boundaries ('. ', '.\n', '! ', '? ') within the [min, max] window.
 * Falls back to hard character cut if no sentence boundary is found.
 *
 * Consecutive chunks overlap by `overlap` characters to preserve context.
 */
function splitWithSentenceBoundary(
  text: string,
  target: number,
  min: number,
  max: number,
  overlap: number,
): string[] {
  // Text is short enough to return as-is
  if (text.length <= max) return [text.trim()].filter(c => c.length >= 10)

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + target

    // Reached or passed the end — take the rest
    if (end >= text.length) {
      const tail = text.slice(start).trim()
      if (tail.length >= 10) chunks.push(tail)
      break
    }

    // Search for a sentence boundary within [min, max] window relative to start
    const searchStart = Math.min(start + min, text.length)
    const searchEnd   = Math.min(start + max, text.length)
    const window = text.slice(searchStart, searchEnd)

    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('.\n'),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
    )

    if (sentenceEnd !== -1) {
      // +2 includes the punctuation + space
      end = searchStart + sentenceEnd + 2
    }
    // else: no sentence boundary found, hard-cut at `target`

    const chunk = text.slice(start, end).trim()
    if (chunk.length >= 10) chunks.push(chunk)

    // Advance start with overlap
    start = Math.max(start + 1, end - overlap)
  }

  return chunks
}
