/**
 * LLMs sometimes wrap HTML fragments in markdown fences. Strip them so UI/PDF never shows ```html.
 */
export function sanitizeReportHtmlFragment(raw: string): string {
  let s = (raw || '').trim()
  if (!s) return s

  // Remove lines that are only a fence (common leak in the middle of HTML)
  s = s.replace(/^\s*```(?:html|HTML)?\s*$/gm, '')
  s = s.replace(/^\s*```\s*$/gm, '')

  // Leading fence
  s = s.replace(/^```(?:html|HTML)?\s*/i, '')
  s = s.replace(/^```\s*/i, '')

  // Trailing fence
  s = s.replace(/\s*```\s*$/i, '')

  // Any stray inline fence tokens
  s = s.replace(/```(?:html|HTML)?/gi, '')
  s = s.replace(/```/g, '')

  return s.trim()
}
