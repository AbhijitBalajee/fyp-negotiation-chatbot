/**
 * Lightweight client-side filter for obvious trolling / keyboard mashing.
 * During debrief, short legitimate answers (e.g. "Yes") are allowed.
 */
export function isGibberishOrTroll(text: string, opts: { debriefMode: boolean }): boolean {
  const t = text.trim()
  if (!t) return true

  // Repeated single character (e.g. "aaaaaaa")
  if (/(.)\1{7,}/.test(t)) return true

  // Mostly non-word characters (emojis-only / punctuation spam)
  const letters = t.replace(/[^a-zA-Z]/g, '')
  const digits = (t.match(/\d/g) || []).length
  if (t.length >= 8 && letters.length + digits < t.length * 0.25) return true

  // Long "consonant salad" with almost no vowels
  if (letters.length >= 18) {
    const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length
    const ratio = vowels / letters.length
    if (ratio < 0.07) return true
  }

  // Classic keyboard mash tokens
  const compact = t.toLowerCase().replace(/\s+/g, '')
  if (/^(asdf|qwerty|zxcv|hjkl|lol){2,}/.test(compact)) return true

  // Debrief: allow short plain answers
  if (opts.debriefMode && t.length <= 48) {
    const plain = /^[\w\s.,!?'"()\-–—]+$/u.test(t)
    if (plain && letters.length >= 1) return false
  }

  // Very short non-debrief
  if (!opts.debriefMode && t.length < 2) return true

  // Long messages with very low letter density
  if (t.length >= 24 && letters.length / t.length < 0.35) return true

  return false
}
