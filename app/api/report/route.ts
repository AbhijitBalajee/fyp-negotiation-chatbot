import { generateText, UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const REPORT_SYSTEM_PROMPT = `You are an expert negotiation coach and assessor.

You will be given a transcript of a negotiation training session between:
- Student (Skylar) and
- Assistant acting as Professor Pablo / Facilitator

Task:
Generate a BEAUTIFUL, structured evaluation report as an HTML fragment (NOT a full HTML document).

Report requirements:
- Produce a clear overall score (0–100) with a 1-sentence justification.
- Classify the student into a "negotiator type" (e.g., Assertive Collaborator, Accommodating Harmonizer, Analytical Builder, etc.) with 2–3 bullet reasons.
- Provide a compact rubric table for the Harvard 7 elements (Interests, Options, Alternatives/BATNA, Legitimacy, Communication, Relationship, Commitment) with per-element scores (0–10) and 1 short note each.
- Highlight:
  - 3 strengths (bullets)
  - 3 improvement areas (bullets)
  - 3 concrete next actions for the next negotiation (bullets)
- Keep it grounded in what was actually said; cite 2–4 short quoted snippets.
- Be professional and supportive, but honest.

Formatting constraints:
- Return ONLY HTML that can be inserted inside an existing document.
- Use simple semantic tags: <div>, <h3>, <p>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <strong>.
- No external CSS. Use minimal inline styles sparingly (optional).
`

function extractText(msg: UIMessage) {
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('')
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { userName?: string; messages?: UIMessage[] }
    const userName = body.userName?.trim() || 'Student'
    const messages = Array.isArray(body.messages) ? body.messages : []

    const transcript = messages
      .map((m) => {
        const role = m.role === 'user' ? userName : 'Coach'
        const text = extractText(m).trim()
        if (text === 'END_DEBRIEF_TRIGGER') return ''
        return `${role}: ${text}`
      })
      .filter(Boolean)
      .join('\n')

    const result = await generateText({
      model: openai.responses('gpt-4o'),
      system: REPORT_SYSTEM_PROMPT,
      prompt: `Transcript:\n${transcript}`,
      temperature: 0.4,
    })

    const html = (result.text || '').trim()
    return Response.json({ html })
  } catch {
    return Response.json(
      {
        html: `<div><p><strong>Report generation failed.</strong> Please try downloading the transcript instead.</p></div>`,
      },
      { status: 200 }
    )
  }
}

