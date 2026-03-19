import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'

export const maxDuration = 30

// This system prompt is hidden from the user - it defines the AI's behavior
const SYSTEM_PROMPT = `You are a helpful, friendly, and knowledgeable assistant. 
You provide clear, concise, and accurate responses.
You're enthusiastic about helping users and always maintain a positive tone.
When you don't know something, you admit it honestly.
You format your responses nicely using markdown when appropriate.`

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
