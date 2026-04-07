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
Generate an evaluation report that matches the REQUIRED structure below.

Critical rules:
- Ground everything in what was actually said in the transcript.
- If information is missing, say "Not evidenced in transcript" rather than inventing facts.
- Be honest, direct, and constructive.
- Avoid long essays; keep each justification compact.

OUTPUT FORMAT (strict):
- Return ONLY an HTML fragment (NOT a full HTML document).
- Use ONLY these tags: <div>, <h3>, <p>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <strong>.
- No external CSS. Inline styles are allowed but must be minimal.

The report content MUST follow this exact structure and headings (verbatim text):

POST-NEGOTIATION EVALUATION REPORT
Candidate: Skylar
Overall Score: X/100

1. INTERESTS (X/20)
- Consideration of Self-Interests (X/8): [Justify with 1–2 examples]
- Inquiry into Other-Party Interests (X/8): [Justify with 1–2 examples]
- Presentation & Justification (X/4): [Justify with 1–2 examples]

2. LEGITIMACY (X/10)
- Understanding Standards (X/5): [Justify]
- Application of Standards (X/5): [Justify]

3. OPTIONS (X/20)
- Alignment with Self-Interests (X/10): [Justify]
- Alignment with Other-Party Interests (X/5): [Justify]
- Creativity and Trade-offs (X/5): [Justify]

4. ALTERNATIVES / BATNA (X/10)
- Strategic Use (X/5): [Justify]
- Outcome vs. BATNA (X/5): [Justify]

5. RELATIONSHIP & COMMUNICATION (X/15)
- Tone and Professionalism (X/8): [Justify]
- Relational Awareness (X/7): [Justify]

6. COMMITMENT (X/15)
- Contingency Planning (X/8): [Justify]
- Feasibility and Specificity (X/7): [Justify]

7. RESEARCH ETHICS (X/10)
- Honesty and Integrity (X/10): [Justify]

AGGRESSION IMPACT ANALYSIS
Level reached: [None / 1 / 2 / 3]
Impact on scoring: [Explain caps/impacts if any]
Specific moments: [Cite examples]

TKI CLASSIFICATION
Primary: [Competing/Collaborating/Compromising/Avoiding/Accommodating] — [Scientist] — "[Quote]"
Secondary: [Competing/Collaborating/Compromising/Avoiding/Accommodating] — [Scientist] — "[Quote]"
[If score ≥90, include: "If you are not at the table, you are on the menu." — Kuan Yee Han]
Justification: [2–3 examples per classification]

SCORE SUMMARY
Category | Max | Score
Interests | 20 | X
Legitimacy | 10 | X
Options | 20 | X
Alternatives/BATNA | 10 | X
Relationship & Communication | 15 | X
Commitment | 15 | X
Research ethics | 10 | X

STRENGTHS
- [2–3 bullets with examples]

WEAKNESSES
- [2–3 bullets with examples]

MISSED OPPORTUNITIES
- [1–3 bullets; what was available and what they could have done]

STRATEGIC ADVICE
- [3–4 actionable recommendations tailored to this transcript]

Scientist analogies and quotes to use exactly:
- Competing — Isaac Newton — "I do not mingle conjectures with certainties"
- Collaborating — Marie Curie — "We are not competing – we are pooling our power"
- Compromising — Charles Darwin — "I have my views, but I will adjust"
- Avoiding — Albert Einstein — "I live in that solitude which is painful in youth"
- Accommodating — Alfred Russel Wallace — "I will set aside my own truth and support yours"

HTML guidance:
- Use <h3> for major sections (e.g., "POST-NEGOTIATION EVALUATION REPORT").
- Use <p> for lines like "Candidate: Skylar".
- Use <ul><li> for bullet lists.
- Use ONE <table> for SCORE SUMMARY with a header row (Category, Max, Score).
- Use <blockquote> for 2–4 short transcript quotes referenced in justifications.
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

