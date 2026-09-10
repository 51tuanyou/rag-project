import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'

type Block =
  | { type: 'text'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

function splitPipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isMdSeparator(line: string): boolean {
  const cells = splitPipeRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c) || /^-+$/.test(c))
}

function isMdTableLine(line: string): boolean {
  const t = line.trim()
  return t.includes('|') && (t.startsWith('|') || t.endsWith('|') || (t.match(/\|/g) || []).length >= 2)
}

/** Split a plain (non-markdown) line into cells using layout cues only — no domain keywords. */
function splitPlainCells(line: string): string[] {
  const t = line.trim()
  if (!t) return []
  if (t.includes('|') && (t.match(/\|/g) || []).length >= 2) {
    return splitPipeRow(t)
  }
  // PDF / monospace style: 2+ spaces or tabs between columns
  const wide = t.split(/\s{2,}|\t+/).map((c) => c.trim()).filter(Boolean)
  if (wide.length >= 3) return wide
  // Single-space fallback: only treat as columns when the line looks like a short
  // multi-token row (not a sentence). Keep this conservative.
  const tokens = t.split(/\s+/).filter(Boolean)
  if (tokens.length >= 4 && tokens.length <= 12 && !looksLikeProse(t)) {
    return tokens
  }
  return [t]
}

/** Generic prose / narrative detection (language-agnostic punctuation + shape). */
function looksLikeProse(line: string): boolean {
  const t = line.trim()
  if (!t) return false

  // Numbered outline / section headings: "5)", "5.", "8.6", "5、"
  if (/^\d+([.．、)]|\)|）)\s*\S/.test(t) && !/^\d+\s+\S+\s+\S+/.test(t)) {
    // "5) something" or "8.6 Title" — not "1 FieldName CODE ..."
    if (/^\d+\.\d+/.test(t) || /^\d+[)）、]\s/.test(t)) return true
  }

  // Sentence / definition punctuation common across CJK and Latin docs
  if (/[：:。；;！？?]/.test(t)) return true

  // Long line with few separators → paragraph, not a table row
  if (t.length >= 40 && (t.match(/\s{2,}|\t|\|/g) || []).length === 0) return true

  return false
}

function isLikelyHeaderLine(line: string): boolean {
  const cells = splitPlainCells(line)
  if (cells.length < 3) return false
  if (looksLikeProse(line)) return false
  // Headers usually are short labels, not long sentences
  const avgLen = cells.reduce((s, c) => s + c.length, 0) / cells.length
  return avgLen <= 24
}

function isLikelyDataRow(line: string, expectedCols: number, rowIndexPattern: boolean | null): boolean {
  const t = line.trim()
  if (!t) return false
  if (looksLikeProse(t)) return false

  const cells = splitPlainCells(t)
  // Column count should stay near the header width
  if (cells.length >= 3) {
    if (Math.abs(cells.length - expectedCols) <= 2) return true
    // Allow slightly ragged PDF rows if still multi-column and not prose
    if (cells.length >= Math.max(3, expectedCols - 2) && cells.length <= expectedCols + 2) return true
  }

  // Rows that start with a running index: "1 xxx yyy zzz"
  if (rowIndexPattern && /^\d{1,4}([.．、)]|\s)\s*\S/.test(t)) {
    const tokens = t.split(/\s+/).filter(Boolean)
    // Index + at least 2 more fields; reject "5) 各字段描述如下"
    if (/^\d+[)）]/.test(t) || /^\d+\.\d+/.test(t)) return false
    if (tokens.length >= 3 && tokens.length <= expectedCols + 3) return true
  }

  return false
}

/**
 * Consume a plain table starting at `start`, stopping as soon as a line no longer
 * looks like a table row. Remaining lines stay for the outer parser as text.
 */
function tryParsePlainTableAt(
  lines: string[],
  start: number
): { table: { headers: string[]; rows: string[][] }; end: number } | null {
  if (start >= lines.length) return null
  const headerLine = lines[start]
  if (!isLikelyHeaderLine(headerLine)) return null

  const headers = splitPlainCells(headerLine)
  if (headers.length < 3) return null

  const rows: string[][] = []
  let i = start + 1
  let rowIndexPattern: boolean | null = null

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) break // blank line ends table

    if (!isLikelyDataRow(line, headers.length, rowIndexPattern)) {
      break
    }

    const cells = splitPlainCells(line.trim())
    // Learn whether rows are index-prefixed from the first successful row
    if (rowIndexPattern === null) {
      rowIndexPattern = /^\d{1,4}([.．、)]|\s)/.test(line.trim())
    }

    // Normalize to header width
    const row = headers.map((_, ci) => cells[ci] ?? '')
    // If split yielded a single blob (prose slipped through), stop instead of absorbing
    if (cells.length === 1 && headers.length >= 3) break

    rows.push(row)
    i += 1
  }

  if (rows.length === 0) return null
  return { table: { headers, rows }, end: i }
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  let textBuf: string[] = []

  const flushText = () => {
    if (textBuf.length) {
      blocks.push({ type: 'text', text: textBuf.join('\n') })
      textBuf = []
    }
  }

  while (i < lines.length) {
    // Markdown table: only pipe-lines; stop at first non-pipe line
    if (
      isMdTableLine(lines[i]) &&
      i + 1 < lines.length &&
      (isMdSeparator(lines[i + 1]) || isMdTableLine(lines[i + 1]))
    ) {
      flushText()
      const tableLines: string[] = []
      while (i < lines.length && isMdTableLine(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      const bodyLines = tableLines.filter((l) => !isMdSeparator(l))
      if (bodyLines.length >= 1) {
        const headers = splitPipeRow(bodyLines[0])
        const rows = bodyLines.slice(1).map(splitPipeRow)
        blocks.push({ type: 'table', headers, rows })
      } else {
        textBuf.push(...tableLines)
      }
      continue
    }

    // Plain layout table
    const plain = tryParsePlainTableAt(lines, i)
    if (plain) {
      flushText()
      blocks.push({ type: 'table', headers: plain.table.headers, rows: plain.table.rows })
      i = plain.end
      continue
    }

    textBuf.push(lines[i])
    i += 1
  }
  flushText()

  // Dedupe consecutive tables with the same header — keep the one with more rows
  const deduped: Block[] = []
  for (const block of blocks) {
    const prev = deduped[deduped.length - 1]
    if (
      block.type === 'table' &&
      prev?.type === 'table' &&
      prev.headers.join('|') === block.headers.join('|')
    ) {
      if (block.rows.length > prev.rows.length) {
        deduped[deduped.length - 1] = block
      }
      continue
    }
    deduped.push(block)
  }
  return deduped
}

export default function ChatMessageContent({ content }: { content: string }) {
  const blocks = parseBlocks(content)

  return (
    <Box sx={{ mt: 0.5 }}>
      {blocks.map((block, idx) => {
        if (block.type === 'text') {
          if (!block.text.trim()) return null
          return (
            <Typography key={idx} variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
              {block.text}
            </Typography>
          )
        }
        return (
          <TableContainer
            key={idx}
            sx={{
              my: 1,
              maxWidth: '100%',
              overflowX: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Table size="small" sx={{ minWidth: 480 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  {block.headers.map((h, hi) => (
                    <TableCell key={hi} sx={{ fontWeight: 600, whiteSpace: 'nowrap', py: 0.75 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {block.rows.map((row, ri) => (
                  <TableRow key={ri}>
                    {block.headers.map((_, ci) => (
                      <TableCell key={ci} sx={{ whiteSpace: 'nowrap', py: 0.5 }}>
                        {row[ci] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      })}
    </Box>
  )
}
