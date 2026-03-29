'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Bot, User, Sparkles, LayoutGrid, Eye, Flag } from 'lucide-react'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [showRoleSheet, setShowRoleSheet] = useState(false)
  const [roleSheetFromModeSelector, setRoleSheetFromModeSelector] = useState(false)
  const [showObjectives, setShowObjectives] = useState(false)
  const [userName, setUserName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!nameSubmitted) {
      nameInputRef.current?.focus()
    }
  }, [nameSubmitted])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    setUserName(nameInput.trim())
    setNameSubmitted(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const trimmed = input.trim().toLowerCase()
    if (
      trimmed.includes('end conversation and begin debrief') ||
      trimmed.includes('end negotiation and begin debrief') ||
      trimmed.includes('begin debrief')
    ) {
      sendMessage({ text: 'END_DEBRIEF_TRIGGER' })
      setInput('')
      return
    }

    sendMessage({ text: input })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const startScenario = () => {
    setShowRoleSheet(false)
    setRoleSheetFromModeSelector(false)
    setShowModeSelector(false)
    sendMessage({
      text: `I have read my role sheet and I am ready to begin the negotiation. Please start the scenario as Professor Pablo.`,
    })
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Role Sheet Modal */}
      {showRoleSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                  Confidential Role Sheet — Skylar (Student)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">National University of Singapore</p>
                <p className="text-xs text-muted-foreground italic mt-1">For Role-Playing Purpose Only</p>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground space-y-4">
                <p>
                  You are taking on the role of a final-year undergraduate student in a negotiation with your academic supervisor. Your task is to engage in a conversation to determine the direction and scope of your research project, while balancing your academic goals, personal circumstances and future aspirations.
                </p>
                <p>
                  <strong>Skylar</strong> is a final-year undergraduate enrolled in National University of Singapore and a recipient of the prestigious Presidential Scholarship. Over the past eight months, you have been working closely with <strong>Professor Pablo</strong> on a research study within a specialised domain of your field. The project is currently at a critical midpoint, with most of the foundational research already completed and preliminary findings conducted. You have invested significant time and intellectual effort into the project and its direction aligns closely with your long-term ambition to pursue postgraduate research.
                </p>
                <p>
                  However, beyond academic commitments, you are overwhelmed with a particularly demanding schedule. Final examinations are approaching, and you are concurrently managing family-related obligations that have begun to take up time and emotional capacity. Over the past month, your mother has been diagnosed with Stage Four cancer. As the sole caregiver in a single-parent household, you now find yourself juggling hospital visits, financial responsibilities and emotional strain alongside your academic workload. While you have tried to make steady progress on your research, you are increasingly aware of the need to prioritise completing the research to ensure you are able to graduate on time.
                </p>
                <p>
                  <strong>Professor Pablo</strong>, your professor, is a well-established expert in his field with a growing research group and a strong publication record. He has been supporting you closely in your research. However, Professor Pablo has proposed to you to pivot your research focus towards a newer and more promising area. While this shift could potentially lead to a more impactful outcome, it also means revisiting earlier work, redefining its scope and potentially extending the timeline required for completion. From your perspective, this proposal introduces a lot of uncertainty. A sudden shift at this stage may increase your workload, delay your graduation and move you away from the research direction you are genuinely interested in pursuing.
                </p>
                <p>
                  At the same time, you recognise that Professor Pablo plays a critical role in your academic future. His evaluation will directly influence your final grade and his recommendation will be essential for postgraduate applications. Maintaining a positive working relationship is therefore an important consideration.
                </p>
                <p>
                  While you could explore alternatives such as requesting to retain the current scope, researching on a scaled-down version or in more extreme cases, seeking a different supervisor, these options come with risks. Another alternative you have in mind is <strong>Professor Lambert</strong>, who is also a leading figure, but in a field different from your research scope, and he may not be available or willing to take on another student at such a late stage given his tight schedule. Furthermore, changing professors could disrupt continuity and weaken the strength of future recommendations.
                </p>
                <p>
                  The situation has now reached a turning point where both parties must decide how to move forward. You must determine how to respond to the proposed change in direction and how to balance competing priorities under time pressure and uncertainty. As you enter this negotiation, consider not only what outcome you want to achieve, but also how you communicate your constraints, manage the relationship and create possible solutions that could address both your needs and those of your supervisor.
                </p>
                <p className="font-medium">
                  Your task is to engage in this conversation strategically and thoughtfully. The success of the negotiation will depend not only on the final agreement reached, but also on your ability to navigate trade-offs, uncover underlying interests and handle the inherent tension between performance, wellbeing and long-term goals.
                </p>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRoleSheet(false)
                    if (roleSheetFromModeSelector) {
                      setShowModeSelector(true)
                      setRoleSheetFromModeSelector(false)
                    }
                  }}
                  className="px-6"
                >
                  Go Back
                </Button>
                <Button variant="default" onClick={startScenario} className="px-6">
                  Begin Negotiation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Objectives Modal */}
      {showObjectives && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <div className="text-center mb-5">
                <h2 className="text-base font-bold text-foreground uppercase tracking-wide">
                  Your Goals &amp; Constraints — Skylar
                </h2>
                <p className="text-xs text-muted-foreground italic mt-1">For Role-Playing Purpose Only</p>
              </div>
              <div className="space-y-4 text-sm text-foreground">
                <div>
                  <p className="font-semibold mb-1">Your Main Goal</p>
                  <p className="text-muted-foreground">Complete your research on time and graduate within 4 months, without pivoting to a new field that delays your studies or moves you away from your intended postgraduate direction.</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Key Constraints</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Final examinations are approaching — limited time for research work</li>
                    <li>Your mother has been diagnosed with Stage Four cancer; you are the sole caregiver</li>
                    <li>You need Professor Pablo&apos;s recommendation for postgraduate applications</li>
                    <li>Pivoting now means restarting significant portions of completed work</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Your Alternatives (if no agreement)</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Propose a scaled-down version of the pivot that fits your timeline</li>
                    <li>Request to retain the current research scope with minor adjustments</li>
                    <li>Explore switching to Professor Lambert — though he may be unavailable and switching risks weakening your recommendation letters</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Relationship Consideration</p>
                  <p className="text-muted-foreground">Professor Pablo directly controls your final grade and recommendation letters. Maintaining a positive professional relationship matters even if the outcome is not ideal.</p>
                </div>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowObjectives(false)
                    setShowRoleSheet(true)
                  }}
                  className="px-6"
                >
                  Read Full Role Sheet
                </Button>
                <Button variant="default" onClick={() => setShowObjectives(false)} className="px-6">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="w-10" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Negotiation Coach</h1>
        </div>
        {messages.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModeSelector(true)}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Change Mode
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">

          {/* Step 1: Name capture */}
          {!nameSubmitted ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Negotiation Coach</h2>
              <p className="text-muted-foreground max-w-sm mb-8">
                Before we begin, what&apos;s your name?
              </p>
              <form onSubmit={handleNameSubmit} className="flex flex-col items-center gap-3 w-full max-w-xs">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className={cn(
                    'w-full rounded-xl border border-input bg-background px-4 py-3 text-center',
                    'text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                  )}
                />
                <Button type="submit" className="w-full" disabled={!nameInput.trim()}>
                  Continue
                </Button>
              </form>
            </div>
          ) : messages.length === 0 ? (
            /* Step 2: Welcome + mode buttons */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Hi {userName}, welcome to Negotiation Coach!
              </h2>
              <p className="text-muted-foreground max-w-lg mb-8">
                Sharpen your negotiation skills by practising a real-world scenario or reviewing key concepts first. You can choose:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
                <Button
                  variant="default"
                  className="h-auto py-4 px-6 flex-1 max-w-xs"
                  onClick={() => setShowRoleSheet(true)}
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
                      text: `Before starting the negotiation, please give me a quick breakdown of key negotiation concepts to guide my strategy. Cover the following 7 elements:\n\n1. **Interests** – Understanding goals and priorities\n2. **Options** – Brainstorming possible solutions\n3. **Alternatives (BATNA)** – Best alternatives if negotiation fails\n4. **Legitimacy** – Fair standards, precedents, or objective criteria\n5. **Communication** – Expressing needs clearly and listening actively\n6. **Relationship** – Maintaining trust and positive rapport\n7. **Commitment** – Working toward mutually acceptable agreements\n\nPlease explain each concept briefly so I can use this framework during the scenario.`,
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
            /* Step 3: Chat */
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
                        setRoleSheetFromModeSelector(true)
                        setShowRoleSheet(true)
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
                          text: `Please review the key negotiation concepts with me. Explain the 7 elements: Interests, Options, Alternatives (BATNA), Legitimacy, Communication, Relationship, and Commitment.`,
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

      {/* Input — only show after name is submitted and chat has started */}
      {nameSubmitted && messages.length > 0 && (
        <footer className="border-t border-border bg-background p-4">
          {/* Action buttons row */}
          <div className="mx-auto mb-3 flex max-w-3xl items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              onClick={() => setShowObjectives(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Objectives
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-medium text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                sendMessage({ text: 'END_DEBRIEF_TRIGGER' })
              }}
            >
              <Flag className="h-3.5 w-3.5" />
              End Negotiation
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Type your message… or "End conversation and begin debrief" to wrap up'
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
      )}
    </div>
  )
}
