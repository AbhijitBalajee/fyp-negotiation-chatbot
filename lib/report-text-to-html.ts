function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * If the model returns plain text instead of HTML, convert it into readable HTML.
 * This keeps the nice visual design while restoring clean formatting.
 */
export function reportTextToHtml(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return ''

  // If it already looks like HTML, keep it.
  if (/<\s*(div|h3|p|ul|li|table|thead|tbody|tr|th|td|blockquote|strong)\b/i.test(text)) {
    return text
  }

  const lines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const out: string[] = []

  let i = 0
  let inList = false
  const closeList = () => {
    if (inList) out.push('</ul>')
    inList = false
  }

  const openList = () => {
    if (!inList) out.push('<ul>')
    inList = true
  }

  const startTable = () => {
    out.push('<table><thead><tr><th>Category</th><th>Max</th><th>Score</th></tr></thead><tbody>')
  }
  const endTable = () => out.push('</tbody></table>')

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      closeList()
      i++
      continue
    }

    // Major headings
    if (
      /^POST-NEGOTIATION EVALUATION REPORT$/i.test(line) ||
      /^AGGRESSION IMPACT ANALYSIS$/i.test(line) ||
      /^TKI CLASSIFICATION$/i.test(line) ||
      /^SCORE SUMMARY$/i.test(line) ||
      /^(STRENGTHS|WEAKNESSES|MISSED OPPORTUNITIES|STRATEGIC ADVICE)$/i.test(line) ||
      /^\d+\.\s/.test(line)
    ) {
      closeList()
      out.push(`<h3>${esc(line)}</h3>`)

      // SCORE SUMMARY table block (pipe-delimited rows)
      if (/^SCORE SUMMARY$/i.test(line)) {
        // skip optional header line: "Category | Max | Score"
        i++
        if (i < lines.length && /^Category\s*\|/i.test(lines[i].trim())) i++

        startTable()
        while (i < lines.length) {
          const row = lines[i].trim()
          if (!row) break
          if (!row.includes('|')) break
          const parts = row.split('|').map((p) => p.trim())
          if (parts.length >= 3) {
            out.push(`<tr><td>${esc(parts[0])}</td><td>${esc(parts[1])}</td><td>${esc(parts[2])}</td></tr>`)
          }
          i++
        }
        endTable()
        continue
      }

      i++
      continue
    }

    // Candidate/overall score lines
    if (/^(Candidate|Overall Score):/i.test(line)) {
      closeList()
      out.push(`<p><strong>${esc(line.split(':')[0])}:</strong>${esc(line.slice(line.indexOf(':') + 1))}</p>`)
      i++
      continue
    }

    // Bullet-like lines
    if (/^[-*•]\s+/.test(line)) {
      openList()
      out.push(`<li>${esc(line.replace(/^[-*•]\s+/, ''))}</li>`)
      i++
      continue
    }

    // Everything else as paragraph
    closeList()
    out.push(`<p>${esc(line)}</p>`)
    i++
  }

  closeList()
  return `<div>${out.join('')}</div>`
}

