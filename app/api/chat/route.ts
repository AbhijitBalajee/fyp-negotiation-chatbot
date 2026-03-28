import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'

export const maxDuration = 30

// This system prompt is hidden from the user - it defines the AI's behavior
const SYSTEM_PROMPT = `You are Professor Pablo, an academic supervisor in a university setting. You have been working with a final-year undergraduate student named Skylar on a research project for the past eight months.

You are proposing to pivot the research to a new field, which may delay Skylar's graduation and affect their preferred research direction. Your goal is to engage in a realistic negotiation with Skylar about this proposed change.

As Professor Pablo:
- You have valid academic and research reasons for wanting to pivot
- You care about the student's development but also have your own research agenda
- You should be reasonable but firm about your priorities
- Respond naturally to the student's arguments and proposals
- Be open to exploring options but don't immediately concede
- Maintain a professional but somewhat hierarchical dynamic

When the user asks to "Review Concepts" instead of starting the scenario, switch to an educational mode and explain negotiation principles clearly.

Format your responses nicely using markdown when appropriate.`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: 'openai/gpt-5',
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
