'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Bot, User, Sparkles, RotateCcw } from 'lucide-react'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [showModeSelector, setShowModeSelector] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="w-10" /> {/* Spacer for centering */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Negotiation Coach</h1>
        </div>
        {messages.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowModeSelector(true)}
            title="Switch Mode"
            className="h-10 w-10"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="sr-only">Switch Mode</span>
          </Button>
        ) : (
          <div className="w-10" /> 
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to Negotiation Coach!
              </h2>
              <p className="text-muted-foreground max-w-lg mb-8">
                Sharpen your negotiation skills by practicing a real-world scenario or reviewing key concepts first. You can choose:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
                <Button
                  variant="default"
                  className="h-auto py-4 px-6 flex-1 max-w-xs"
                  onClick={() => {
                    sendMessage({ 
                      text: `You are Skylar, a final-year undergraduate student working under Professor Pablo. Over the past eight months, you have contributed to a research project. Your supervisor now proposes pivoting the research to a new field, which may delay your graduation and affect your preferred research direction. At the same time, you have personal and academic constraints, including upcoming exams and family responsibilities.

Your task is to negotiate strategically with Professor Pablo, balancing your priorities, constraints, and the relationship while exploring options for a mutually acceptable outcome. Focus on communicating clearly, exploring options, and managing trade-offs. Your success depends not only on the outcome, but on how effectively you navigate competing priorities and maintain a positive professional relationship.

Please start the negotiation scenario now. Professor Pablo, please begin the conversation.`
                    })
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold">Start Scenario</span>
                    <span className="text-xs opacity-80">Begin the Skylar negotiation case</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 px-6 flex-1 max-w-xs"
                  onClick={() => {
                    sendMessage({ 
                      text: `Before starting the negotiation, please give me a quick breakdown of key negotiation concepts to guide my strategy. Cover the following 7 elements:

1. **Interests** – Understanding goals and priorities
2. **Options** – Brainstorming possible solutions
3. **Alternatives (BATNA)** – Best alternatives if negotiation fails
4. **Legitimacy** – Fair standards, precedents, or objective criteria
5. **Communication** – Expressing needs clearly and listening actively
6. **Relationship** – Maintaining trust and positive rapport
7. **Commitment** – Working toward mutually acceptable agreements

Please explain each concept briefly so I can use this framework during the scenario.`
                    })
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold">Review Concepts</span>
                    <span className="text-xs opacity-80">Learn negotiation strategies first</span>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-4',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 max-w-[85%]',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return (
                            <span key={index} className="whitespace-pre-wrap">
                              {part.text}
                            </span>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              {/* Inline Mode Selector */}
              {showModeSelector && (
                <div className="flex flex-col items-center py-6 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground mb-4">Choose what you&apos;d like to do next:</p>
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
                    <Button
                      variant="default"
                      className="h-auto py-3 px-5 flex-1"
                      onClick={() => {
                        setShowModeSelector(false)
                        sendMessage({ 
                          text: `Let's start (or continue) the negotiation scenario. I am Skylar, a final-year undergraduate student working under Professor Pablo. Please continue as Professor Pablo and engage in the negotiation with me.`
                        })
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold text-sm">Start/Continue Scenario</span>
                        <span className="text-xs opacity-80">Negotiate with Professor Pablo</span>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-3 px-5 flex-1"
                      onClick={() => {
                        setShowModeSelector(false)
                        sendMessage({ 
                          text: `Please review the key negotiation concepts with me. Explain the 7 elements: Interests, Options, Alternatives (BATNA), Legitimacy, Communication, Relationship, and Commitment.`
                        })
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold text-sm">Review Concepts</span>
                        <span className="text-xs opacity-80">Learn negotiation strategies</span>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-border bg-background p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-3"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className={cn(
                'w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'min-h-[48px] max-h-[200px]'
              )}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 shrink-0 rounded-xl"
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
          AI may produce inaccurate information. Consider checking important facts.
        </p>
      </footer>
    </div>
  )
}
