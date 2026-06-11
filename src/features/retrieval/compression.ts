import { SearchResult } from './types'
import { estimateTokens } from '@/features/pipeline/processor'

/**
 * Compresses prompt context chunks to save prompt tokens:
 *   1. Removes duplicate chunks by normalized content.
 *   2. Strips repeated headers, footers, boilerplate, and page numbering artifacts.
 *   3. Measures the number of tokens saved from the process.
 */
export function compressContext(
  chunks: SearchResult[]
): { compressedChunks: SearchResult[]; tokensSaved: number } {
  const seenContent = new Set<string>()
  const uniqueChunks: SearchResult[] = []

  let originalTokens = 0
  for (const chunk of chunks) {
    originalTokens += estimateTokens(chunk.content)

    const normalized = chunk.content.trim().toLowerCase()
    if (!seenContent.has(normalized)) {
      seenContent.add(normalized)
      uniqueChunks.push({ ...chunk })
    }
  }

  const compressedChunks = uniqueChunks.map((chunk) => {
    let text = chunk.content

    // Boilerplate, footers, headers, and page artifacts patterns to strip
    const patterns = [
      /page \d+ of \d+/gi,
      /page \d+/gi,
      /company confidential/gi,
      /all rights reserved/gi,
      /confidential \/\/ regulatory compliance/gi,
      /proprietary and confidential/gi,
      /draft - do not distribute/gi,
    ]

    for (const pattern of patterns) {
      text = text.replace(pattern, '')
    }

    // Standardize whitespace
    text = text.replace(/\s+/g, ' ').trim()

    return {
      ...chunk,
      content: text,
    }
  })

  let compressedTokens = 0
  for (const chunk of compressedChunks) {
    compressedTokens += estimateTokens(chunk.content)
  }

  const tokensSaved = Math.max(0, originalTokens - compressedTokens)

  return {
    compressedChunks,
    tokensSaved,
  }
}
