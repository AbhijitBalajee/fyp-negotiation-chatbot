'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { sanitizeReportHtmlFragment } from '@/lib/sanitize-report-html'
import { FINAL_REPORT_BODY_CSS } from '@/lib/final-report-body-css'
import { isGibberishOrTroll } from '@/lib/gibberish'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  Send,
  Bot,
  User,
  Sparkles,
  LayoutGrid,
  Eye,
  Flag,
  Download,
  Menu,
  MessageSquareText,
  BookOpen,
  FileDown,
} from 'lucide-react'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [showRoleSheet, setShowRoleSheet] = useState(false)
  const [showObjectives, setShowObjectives] = useState(false)
  const [showCaseStudy, setShowCaseStudy] = useState(false)
  const [finalReportHtml, setFinalReportHtml] = useState<string | null>(null)
  const [finalReportGenerating, setFinalReportGenerating] = useState(false)
  const [showFinalReport, setShowFinalReport] = useState(false)
  const [trollStrikes, setTrollStrikes] = useState(0)
  const [clarityStrikes, setClarityStrikes] = useState(0)
  const [awaitingClarification, setAwaitingClarification] = useState(false)
  const [clarityPopup, setClarityPopup] = useState<{
    open: boolean
    title: string
    body: string
    level: 'warn' | 'final' | 'ended'
  }>({ open: false, title: '', body: '', level: 'warn' })
  const [finalReportSessionAt, setFinalReportSessionAt] = useState<string | null>(null)
  const [autoDebriefTriggered, setAutoDebriefTriggered] = useState(false)
  const [pendingAutoDebrief, setPendingAutoDebrief] = useState(false)
  const [userName, setUserName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const pendingAutoDebriefTimerRef = useRef<number | null>(null)
  const clarityPopupTimerRef = useRef<number | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const stripConclusionMarker = (text: string) =>
    text
      .split('\n')
      .filter((l) => l.trim() !== 'NEGOTIATION_CONCLUDED')
      .join('\n')

  const assistantConcluded = (text: string) =>
    text.split('\n').some((l) => l.trim() === 'NEGOTIATION_CONCLUDED')

  // Auto-end scenario when the assistant clearly concludes (agreement or walk-away),
  // so the user doesn't need to press "End Negotiation".
  useEffect(() => {
    if (autoDebriefTriggered) return
    if (showFinalReport) return
    if (isLoading) return
    if (messages.length < 6) return

    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!last) return
    const text = last.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('')
    const lower = text.toLowerCase()

    // Preferred: explicit marker from the model
    if (assistantConcluded(text)) {
      setPendingAutoDebrief(true)
      if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
      pendingAutoDebriefTimerRef.current = window.setTimeout(() => {
        setAutoDebriefTriggered(true)
        setPendingAutoDebrief(false)
        generateFinalReportNow(messages)
      }, 1200)
      return
    }

    const concluded =
      /we['’]ve reached a decision/.test(lower) ||
      /let['’]s pause here/.test(lower) ||
      /i(?:’|')ll proceed with the pivot/.test(lower) ||
      /no agreement/.test(lower) ||
      /i wish you well/.test(lower) ||
      /end (?:the )?negotiation/.test(lower)

    if (!concluded) return

    setPendingAutoDebrief(true)
    if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
    pendingAutoDebriefTimerRef.current = window.setTimeout(() => {
      setAutoDebriefTriggered(true)
      setPendingAutoDebrief(false)
      generateFinalReportNow(messages)
    }, 1200)
  }, [autoDebriefTriggered, isLoading, messages, showFinalReport])

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

  const newId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(16).slice(2)}`

  const isPolarQuestion = (assistantText: string) => {
    const t = assistantText.trim().toLowerCase()
    if (!t) return false
    if (!t.includes('?')) return false
    if (t.includes('yes or no') || t.includes('yes/no')) return true
    // Heuristic: starts with auxiliary verb and contains a question mark.
    return /^(do|did|does|is|are|was|were|can|could|will|would|have|has|had|should)\b/.test(t)
  }

  const isLowClarityMessage = (raw: string, ctx?: { lastAssistantText?: string }) => {
    const t = raw.trim()
    if (!t) return true
    // Allow common short but meaningful controls/commands.
    const lower = t.toLowerCase()
    const lastAssistantText = ctx?.lastAssistantText ?? ''
    const assistantAskedPolar = isPolarQuestion(lastAssistantText)
    const allowedShort =
      ((lower === 'yes' || lower === 'no') && assistantAskedPolar) ||
      lower === 'ok' ||
      lower === 'okay' ||
      lower === 'thanks' ||
      lower === 'thank you' ||
      lower === 'continue' ||
      lower === 'resume' ||
      lower === 'go back' ||
      lower.includes('begin debrief') ||
      lower.includes('end negotiation') ||
      lower.includes('end conversation')
    if (allowedShort) return false

    // If we're in a "clarify your answer" loop, do not allow yes/no as a valid follow-up.
    if (awaitingClarification && (lower === 'yes' || lower === 'no')) return true

    // If user replies "yes/no" but assistant asked an open question, treat as low clarity.
    if ((lower === 'yes' || lower === 'no') && !assistantAskedPolar) return true

    // If it's very short, it frequently causes the model to guess/derail.
    const words = t.split(/\s+/).filter(Boolean)
    if (t.length < 10) return true
    if (words.length < 4) return true
    return false
  }

  const resetCaseStudySession = () => {
    setMessages([])
    setAutoDebriefTriggered(false)
    setPendingAutoDebrief(false)
    if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
    pendingAutoDebriefTimerRef.current = null
    setFinalReportHtml(null)
    setFinalReportGenerating(false)
    setShowFinalReport(false)
    setFinalReportSessionAt(null)
    setTrollStrikes(0)
    setClarityStrikes(0)
    setClarityPopup({ open: false, title: '', body: '', level: 'warn' })
    setInput('')
    setShowRoleSheet(false)
    setShowCaseStudy(false)
    setShowObjectives(false)
  }

  const generateFinalReportNow = (sourceMessages = messages) => {
    setShowFinalReport(true)
    setFinalReportSessionAt(new Date().toLocaleString())
    setFinalReportGenerating(true)
    fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userName, messages: sourceMessages }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to generate report')
        const data = (await res.json()) as { html: string }
        setFinalReportHtml(sanitizeReportHtmlFragment(data.html))
      })
      .catch(() => setFinalReportHtml(null))
      .finally(() => setFinalReportGenerating(false))
  }

  const openClarityPopup = (next: {
    title: string
    body: string
    level?: 'warn' | 'final' | 'ended'
    autoCloseMs?: number
  }) => {
    if (clarityPopupTimerRef.current) window.clearTimeout(clarityPopupTimerRef.current)
    clarityPopupTimerRef.current = null

    setClarityPopup({
      open: true,
      level: next.level ?? 'warn',
      title: next.title,
      body: next.body,
    })

    const ms = next.autoCloseMs ?? 2600
    if (ms > 0) {
      clarityPopupTimerRef.current = window.setTimeout(() => {
        setClarityPopup((p) => ({ ...p, open: false }))
        clarityPopupTimerRef.current = null
      }, ms)
    }
  }

  const buildClarityFollowUp = (args: {
    userText: string
    lastAssistantText: string
    strike: number
  }) => {
    const raw = args.userText.trim()
    const lower = raw.toLowerCase()
    const last = args.lastAssistantText.trim()
    const lastLower = last.toLowerCase()

    // Try to reference the professor's last question (keeps it "natural")
    const lastQuestionLine = (() => {
      const lines = last.split('\n').map((l) => l.trim()).filter(Boolean)
      const q = [...lines].reverse().find((l) => l.includes('?'))
      if (!q) return ''
      // Keep it short so we don't dump paragraphs into the prompt.
      return q.length > 140 ? `${q.slice(0, 140)}…` : q
    })()

    // Special-case: yes/no without context (common failure mode)
    if (lower === 'yes' || lower === 'no') {
      const variants = [
        `Yes/no to *which part* exactly? ${lastQuestionLine ? `\n\nYou’re responding to: “${lastQuestionLine}”` : ''}\n\nGive me one clear sentence with the specific point you’re agreeing/disagreeing with.`,
        `I can’t act on just “${raw}”. ${lastQuestionLine ? `Are you answering: “${lastQuestionLine}”` : 'What are you responding to?'}\n\nTell me what you mean in one sentence.`,
        `Hold on — “${raw}” isn’t enough.\n\nWhat are you saying ${raw} to, and what do you want to happen next?`,
      ]
      return variants[(args.strike - 1) % variants.length]
    }

    // Context-specific nudges so it feels like a real professor, not a template.
    if (lastLower.includes('hours') || lastLower.includes('commit') || lastLower.includes('commitment')) {
      const variants = [
        `I need specifics on commitment. How many hours per week can you *actually* do for the next month, and after finals?`,
        `Don’t stay vague. Give me a number: weekly hours, and how you’ll keep me updated if something slips.`,
      ]
      return variants[(args.strike - 1) % variants.length]
    }
    if (lastLower.includes('stipend') || lastLower.includes('$') || lastLower.includes('financial')) {
      const variants = [
        `If you’re raising funding, be concrete. What stipend are you asking for, and what’s the justification?`,
        `Numbers, not hints. Tell me the amount and the reason — otherwise I can’t take it seriously.`,
      ]
      return variants[(args.strike - 1) % variants.length]
    }
    if (lastLower.includes('lambert') || lastLower.includes('outside') || lastLower.includes('shared') || lastLower.includes('confidential')) {
      const variants = [
        `Answer this directly: did you share any project details outside the group? Yes or no — then one sentence of context.`,
        `I’m asking about confidentiality. Did anything leave the lab? Be direct.`,
      ]
      return variants[(args.strike - 1) % variants.length]
    }
    if (lastLower.includes('pivot') || lastLower.includes('scope') || lastLower.includes('direction')) {
      const variants = [
        `Which path are you arguing for — original scope, bridge pivot, or full pivot? Pick one and tell me why.`,
        `Be explicit: what do you want the scope to be, and what deliverable are you committing to?`,
      ]
      return variants[(args.strike - 1) % variants.length]
    }

    // General low-clarity follow-ups (firm, but varied)
    const generalVariants = [
      `I’m not sure what you mean by that. ${lastQuestionLine ? `\n\nAnswer this directly: “${lastQuestionLine}”` : ''}\n\nOne or two sentences — no filler.`,
      `Pause. Why did you reply like that? ${lastQuestionLine ? `\n\nRespond to: “${lastQuestionLine}”` : ''}\n\nTell me what you want, clearly.`,
      `That’s too vague to act on. ${lastQuestionLine ? `\n\nAnswer the question: “${lastQuestionLine}”` : ''}\n\nWhat are you proposing, exactly?`,
      `I can’t move forward on that. ${lastQuestionLine ? `\n\nCan you answer: “${lastQuestionLine}”` : ''}\n\nState your position, then your next step.`,
    ]
    return generalVariants[(args.strike - 1) % generalVariants.length]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const trimmed = input.trim().toLowerCase()

    // If the negotiation just concluded and the user wants to keep going, cancel auto-debrief.
    if (pendingAutoDebrief) {
      const wantsContinue =
        trimmed.includes('continue') ||
        trimmed.includes('resume') ||
        trimmed.includes('go back') ||
        trimmed.includes('back to negotiation') ||
        trimmed.includes('keep negotiating') ||
        trimmed.includes('scenario')

      if (wantsContinue) {
        setPendingAutoDebrief(false)
        if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
        pendingAutoDebriefTimerRef.current = null
      }
    }
    if (
      trimmed.includes('end conversation and begin debrief') ||
      trimmed.includes('end negotiation and begin debrief') ||
      trimmed.includes('begin debrief') ||
      trimmed.includes('end negotiation') ||
      trimmed.includes('end conversation') ||
      /\b(let['’]?s|lets)\s+(end|wrap up|finish|stop)\b/.test(trimmed) ||
      /\bwe\s+(are|re)\s+(done|finished)\b/.test(trimmed) ||
      /\bwrap\s+up\b/.test(trimmed) ||
      /\bend\s+this\s+(now|here|session)\b/.test(trimmed)
    ) {
      setAutoDebriefTriggered(true)
      setPendingAutoDebrief(false)
      if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
      pendingAutoDebriefTimerRef.current = null
      generateFinalReportNow(messages)
      setInput('')
      return
    }

    // Clear-communication enforcement: if the user keeps sending vague/unclear messages,
    // issue firm warnings and end the session with a final report.
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    const lastAssistantText =
      lastAssistant?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('')
        .trim() ?? ''

    if (isLowClarityMessage(input, { lastAssistantText })) {
      setAwaitingClarification(true)
      const uidUser = newId()
      const uidBot = newId()
      const userText = input
      setInput('')

      setClarityStrikes((prev) => {
        const strike = prev + 1

        const followUp = buildClarityFollowUp({
          userText,
          lastAssistantText,
          strike,
        })

        // Always record what the user typed (for transcript/report),
        // but DO NOT send to the model while clarity enforcement is active.
        setMessages((prevMsgs) => [
          ...prevMsgs,
          {
            id: uidUser,
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: userText }],
          },
          {
            id: uidBot,
            role: 'assistant' as const,
            parts: [{ type: 'text' as const, text: followUp }],
          },
        ])

        openClarityPopup({
          title: `WARNING (${strike})`,
          body:
            strike === 1
              ? `Your message is too unclear to evaluate.\n\nWrite a complete sentence (1–2 lines) with a specific request or counterproposal.`
              : `Still unclear.\n\nBe specific: (a) what you want, (b) why, (c) what you can offer in return.`,
          autoCloseMs: 2600,
        })
        return strike
      })
      return
    }

    // If the user sends a usable message, we can exit the "clarify your answer" loop,
    // but we do NOT reset strike counters (those only reset after final report → back to chat).
    if (awaitingClarification) setAwaitingClarification(false)

    if (isGibberishOrTroll(input, { debriefMode: false })) {
      const uidUser = newId()
      const uidBot = newId()
      const userText = input
      setInput('')

      // Use a functional update so strikes can't get "stuck" due to stale state.
      setTrollStrikes((prevStrikes) => {
        const strike = prevStrikes + 1

        // Troll/gibberish escalation flow:
        // - Strikes 1–4: warnings
        // - Strike 5: check-in ("do you even want to continue?")
        // - Strikes 6–7: last chances
        // - Strike 8+: pause session and generate final report
        const warnings: Record<number, string> = {
          1: '**WARNING (1/4):** Stay on task. Messages must be clear and relevant to the negotiation exercise.',
          2: '**WARNING (2/4):** Keep your contributions serious and related to the scenario. Continued disruption will trigger a check‑in and may end the session.',
          3: '**FORMAL WARNING (3/4):** One more unproductive message triggers a check‑in.',
          4: '**FINAL WARNING (4/4):** Next unproductive message triggers a check‑in.',
          5: '**CHECK‑IN:** Do you actually want to continue the negotiation exercise?\n\nIf yes, reply with one serious, scenario‑relevant message. If you keep trolling 3 more times, I will pause the session and generate your final report.',
          6: '**LAST CHANCE (1/3):** One serious message or we pause the session.',
          7: '**LAST CHANCE (2/3):** Next time I will pause the session and generate your final report.',
        }

        setMessages((prev) => {
          const base = [
            ...prev,
            {
              id: uidUser,
              role: 'user' as const,
              parts: [{ type: 'text' as const, text: userText }],
            },
          ]

          if (strike >= 8) {
            const nextMessages = [
              ...base,
              {
                id: uidBot,
                role: 'assistant' as const,
                parts: [
                  {
                    type: 'text' as const,
                    text:
                      '**PAUSING SESSION:** It looks like you’re not engaging with the exercise right now.\n\nTake a few minutes, then come back when you’re ready to negotiate seriously. I’m generating your final report based on what you wrote so far.',
                  },
                ],
              },
            ]
            generateFinalReportNow(nextMessages)
            return nextMessages
          }

          return [
            ...base,
            {
              id: uidBot,
              role: 'assistant' as const,
              parts: [
                {
                  type: 'text' as const,
                  text: warnings[strike] ?? warnings[1],
                },
              ],
            },
          ]
        })

        return strike
      })
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

  const downloadTranscript = () => {
    const timestamp = new Date().toLocaleString()
    const lines: string[] = [
      'NEGOTIATION COACH — SESSION TRANSCRIPT',
      `Student: ${userName}`,
      `Date: ${timestamp}`,
      '='.repeat(60),
      '',
    ]
    messages.forEach((msg) => {
      const role = msg.role === 'user' ? `${userName} (You)` : 'Negotiation Coach (Professor Pablo / Facilitator)'
      const text = msg.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('')
      // Skip internal trigger messages
      if (text.trim() === 'END_DEBRIEF_TRIGGER') return
      lines.push(`[${role}]`)
      lines.push(text)
      lines.push('')
    })
    lines.push('='.repeat(60))
    lines.push('End of transcript.')
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `negotiation-transcript-${userName.toLowerCase().replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadFinalReport = () => {
    const timestamp = new Date().toLocaleString()
    const safeName = userName.toLowerCase().replace(/\s+/g, '-')

    const transcriptHtml = messages
      .map((msg) => {
        const role =
          msg.role === 'user'
            ? `${userName} (Student)`
            : 'Negotiation Coach (Professor Pablo / Facilitator)'
        const text = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')

        if (text.trim() === 'END_DEBRIEF_TRIGGER') return ''

        const bubbleClass =
          msg.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant'

        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/\n/g, '<br/>')

        return `
          <div class="turn">
            <div class="meta">${role}</div>
            <div class="${bubbleClass}">${escaped}</div>
          </div>
        `
      })
      .join('\n')

    const safeEval = sanitizeReportHtmlFragment(finalReportHtml || '')
    const coachingSection = safeEval
      ? `<div class="card" style="margin-top:14px">
           <h2>Evaluation summary</h2>
           ${safeEval}
         </div>`
      : `<div class="card" style="margin-top:14px">
           <h2>Evaluation summary</h2>
           <div class="meta">Report not available. You can still use the transcript below.</div>
         </div>`

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Negotiation Coach — Final Report</title>
    <style>
      :root{
        --bg:#0b0f19; --card:#0f172a; --muted:#94a3b8; --text:#e5e7eb;
        --border:rgba(148,163,184,.18); --accent:#60a5fa; --accent2:#a78bfa;
        --user:#2563eb; --assistant:rgba(148,163,184,.12);
      }
      *{ box-sizing:border-box; }
      body{
        margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        background: radial-gradient(1200px 600px at 15% 0%, rgba(96,165,250,.16), transparent 55%),
                    radial-gradient(900px 600px at 85% 10%, rgba(167,139,250,.12), transparent 60%),
                    var(--bg);
        color:var(--text);
      }
      .wrap{ max-width: 940px; margin: 40px auto; padding: 0 18px 40px; }
      .header{
        border:1px solid var(--border); background: linear-gradient(180deg, rgba(15,23,42,.9), rgba(15,23,42,.75));
        border-radius: 18px; padding: 18px 18px 16px; overflow:hidden;
      }
      .titleRow{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
      h1{ margin:0; font-size: 18px; letter-spacing:.02em; }
      .subtitle{ margin:6px 0 0; color:var(--muted); font-size: 12px; line-height: 1.5; }
      .pill{
        display:inline-flex; align-items:center; gap:8px; padding:8px 10px;
        border:1px solid var(--border); border-radius: 999px; color:var(--muted);
        font-size: 12px; white-space:nowrap;
      }
      .grid{ display:grid; grid-template-columns: 1fr; gap: 14px; margin-top: 14px; }
      .card{
        border:1px solid var(--border); background: rgba(15,23,42,.62);
        border-radius: 18px; padding: 16px;
      }
      .card h2{ margin: 0 0 8px; font-size: 13px; letter-spacing:.06em; text-transform: uppercase; color: rgba(229,231,235,.92); }
      .kv{ display:grid; grid-template-columns: 160px 1fr; gap: 8px 10px; font-size: 13px; }
      .k{ color: var(--muted); }
      .v{ color: var(--text); }
      .turn{ margin: 14px 0; }
      .meta{ font-size: 12px; color: var(--muted); margin: 0 0 6px; }
      .bubble{
        border:1px solid var(--border); border-radius: 16px; padding: 12px 12px;
        font-size: 13px; line-height: 1.6; background: var(--assistant);
      }
      .bubble-user{
        background: linear-gradient(180deg, rgba(37,99,235,.9), rgba(37,99,235,.75));
        border-color: rgba(96,165,250,.35);
      }
      .footer{ margin-top: 14px; color: var(--muted); font-size: 12px; text-align:center; }
      @media (min-width: 860px){
        .grid{ grid-template-columns: 1fr 1fr; }
      }
      @media print{
        body{ background:#fff; color:#111827; }
        .header,.card,.bubble{ background:#fff !important; border-color:#e5e7eb !important; }
        .pill,.k,.meta,.subtitle,.footer{ color:#4b5563 !important; }
        .bubble-user{ background:#eff6ff !important; }
      }
      ${FINAL_REPORT_BODY_CSS}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div class="titleRow">
          <div>
            <h1>Negotiation Coach — Final Report</h1>
            <p class="subtitle">A clean, printable record of your negotiation session.</p>
          </div>
          <div class="pill">Student: <strong style="color:var(--text); font-weight:600">${userName}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <h2>Session details</h2>
            <div class="kv">
              <div class="k">Date</div><div class="v">${timestamp}</div>
              <div class="k">App</div><div class="v">Negotiation Coach</div>
            </div>
          </div>
          <div class="card">
            <h2>How to use</h2>
            <div class="kv">
              <div class="k">Print/PDF</div><div class="v">Use your browser’s print dialog to save as PDF.</div>
              <div class="k">Notes</div><div class="v">Internal trigger messages are excluded from this report.</div>
            </div>
          </div>
        </div>
      </div>

      ${coachingSection}

      <div class="card" style="margin-top:14px">
        <h2>Transcript</h2>
        ${transcriptHtml || '<div class="meta">No messages captured.</div>'}
      </div>

      <div class="footer">Generated by Negotiation Coach</div>
    </div>
  </body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `negotiation-final-report-${safeName}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const startScenario = () => {
    setShowRoleSheet(false)
    sendMessage({
      text: `I have read my role sheet and I am ready to begin the negotiation. Please start the scenario as Professor Pablo.`,
    })
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-background">
      {/* Ambient background (more visible, less "plain") */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-28 left-[-15%] h-[420px] w-[420px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute top-10 right-[-10%] h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[15%] h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      {/* Full-screen final report (same layout as downloadable HTML, view in-app after Q3) */}
      {showFinalReport && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0b0f19] text-[#e5e7eb]">
          <div
            className="pointer-events-none fixed inset-0 -z-10"
            aria-hidden
            style={{
              background:
                'radial-gradient(1200px 600px at 15% 0%, rgba(96,165,250,.16), transparent 55%), radial-gradient(900px 600px at 85% 10%, rgba(167,139,250,.12), transparent 60%), #0b0f19',
            }}
          />
          <div className="mx-auto max-w-[940px] px-[18px] pb-28 pt-10">
            <div className="overflow-hidden rounded-[18px] border border-[rgba(148,163,184,.18)] bg-gradient-to-b from-[rgba(15,23,42,.9)] to-[rgba(15,23,42,.75)] p-[18px]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-lg font-semibold tracking-wide text-[#e5e7eb]">
                    Negotiation Coach — Final Report
                  </h1>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#94a3b8]">
                    A clean, printable record of your negotiation session.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(148,163,184,.18)] px-2.5 py-2 text-xs text-[#94a3b8]">
                  Student:{' '}
                  <strong className="font-semibold text-[#e5e7eb]">{userName}</strong>
                </div>
              </div>
              <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[rgba(148,163,184,.18)] bg-[rgba(15,23,42,.62)] p-4">
                  <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[rgba(229,231,235,.92)]">
                    Session details
                  </h2>
                  <div className="grid grid-cols-[160px_1fr] gap-x-2.5 gap-y-2 text-[13px]">
                    <span className="text-[#94a3b8]">Date</span>
                    <span>{finalReportSessionAt ?? new Date().toLocaleString()}</span>
                    <span className="text-[#94a3b8]">App</span>
                    <span>Negotiation Coach</span>
                  </div>
                </div>
                <div className="rounded-[18px] border border-[rgba(148,163,184,.18)] bg-[rgba(15,23,42,.62)] p-4">
                  <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[rgba(229,231,235,.92)]">
                    How to use
                  </h2>
                  <div className="grid grid-cols-[160px_1fr] gap-x-2.5 gap-y-2 text-[13px]">
                    <span className="text-[#94a3b8]">Print/PDF</span>
                    <span>Use your browser’s print dialog to save as PDF.</span>
                    <span className="text-[#94a3b8]">Notes</span>
                    <span>Internal trigger messages are excluded from this report.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3.5 rounded-[18px] border border-[rgba(148,163,184,.18)] bg-[rgba(15,23,42,.62)] p-5 sm:p-6">
              <h2 className="mb-4 text-[13px] font-medium uppercase tracking-[0.06em] text-[rgba(229,231,235,.92)]">
                Evaluation summary
              </h2>
              {finalReportGenerating && (
                <p className="text-sm text-[#94a3b8]">Generating your report…</p>
              )}
              {!finalReportGenerating && finalReportHtml && (
                <div
                  className="max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeReportHtmlFragment(finalReportHtml),
                  }}
                />
              )}
              {!finalReportGenerating && !finalReportHtml && (
                <p className="text-sm text-[#94a3b8]">
                  Couldn’t generate the report right now. You can still download the transcript from the chat
                  screen.
                </p>
              )}
            </div>

            <div className="mt-3.5 rounded-[18px] border border-[rgba(148,163,184,.18)] bg-[rgba(15,23,42,.62)] p-4">
              <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.06em] text-[rgba(229,231,235,.92)]">
                Transcript
              </h2>
              <div className="space-y-3.5">
                {messages.map((msg) => {
                  const text = msg.parts
                    .filter((p) => p.type === 'text')
                    .map((p) => (p as { type: 'text'; text: string }).text)
                    .join('')
                  if (text.trim() === 'END_DEBRIEF_TRIGGER') return null
                  const role =
                    msg.role === 'user'
                      ? `${userName} (Student)`
                      : 'Negotiation Coach (Professor Pablo / Facilitator)'
                  const isUser = msg.role === 'user'
                  return (
                    <div key={msg.id}>
                      <div className="mb-1.5 text-xs text-[#94a3b8]">{role}</div>
                      <div
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-[13px] leading-relaxed',
                          isUser
                            ? 'border-[rgba(96,165,250,.35)] bg-gradient-to-b from-[rgba(37,99,235,.9)] to-[rgba(37,99,235,.75)] text-white'
                            : 'border-[rgba(148,163,184,.18)] bg-[rgba(148,163,184,.12)] text-[#e5e7eb]'
                        )}
                      >
                        <span className="whitespace-pre-wrap">{text}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="mt-3.5 text-center text-xs text-[#94a3b8]">Generated by Negotiation Coach</p>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-[61] border-t border-[rgba(148,163,184,.18)] bg-[#0b0f19]/90 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-[940px] flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="border-[rgba(148,163,184,.35)] bg-transparent text-[#e5e7eb] hover:bg-[rgba(148,163,184,.12)]"
                onClick={() => {
                  // If the user goes back to chat after viewing a final report,
                  // treat it like a "reset" of warning states.
                  setShowFinalReport(false)
                  setTrollStrikes(0)
                  setClarityStrikes(0)
                  setAwaitingClarification(false)
                  if (clarityPopupTimerRef.current) window.clearTimeout(clarityPopupTimerRef.current)
                  clarityPopupTimerRef.current = null
                  setClarityPopup((p) => ({ ...p, open: false }))
                }}
              >
                Back to chat
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={downloadFinalReport}
                disabled={finalReportGenerating || !finalReportHtml}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download Final Report (.html)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clarity warning popup */}
      {clarityPopup.open && !showFinalReport && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div
            className={cn(
              'w-full max-w-lg rounded-2xl border shadow-xl backdrop-blur',
              clarityPopup.level === 'ended'
                ? 'border-destructive/40 bg-background/90'
                : clarityPopup.level === 'final'
                  ? 'border-destructive/35 bg-background/90'
                  : 'border-destructive/25 bg-background/90'
            )}
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-destructive">{clarityPopup.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {clarityPopup.body}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    if (clarityPopupTimerRef.current) window.clearTimeout(clarityPopupTimerRef.current)
                    clarityPopupTimerRef.current = null
                    setClarityPopup((p) => ({ ...p, open: false }))
                  }}
                >
                  OK
                </Button>
              </div>
              <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground mb-1">Example (copy/paste)</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  I want to keep the original scope and graduate in 4 months. I can commit 10 hours/week for the next month and 30 hours/week after finals, with weekly progress updates. In exchange, I’m asking for the 4‑month “bridge” pivot only (no full restart) and a stipend of $3,500.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  You are taking on the role of Skylar, a final-year undergraduate student, in a negotiation with your academic supervisor. Your task is to engage in a conversation to determine the direction and scope of your research project, while balancing your academic goals, personal circumstance and future aspirations.
                </p>
                <p>
                  <strong>Skylar</strong> is a final-year undergraduate enrolled in National University of Singapore and a recipient of the prestigious Presidential Scholarship. Over the past eight months, he has been working closely with <strong>Professor Pablo</strong> on a research study within [understanding blood-flow hemodynamics and properties through mechanical heart valves], a specialised, niche domain of their field. Skylar is the only researcher below 30 years old that is exploring this field in the whole nation. The project is currently at a critical midpoint, with most of the foundational research already completed and preliminary findings conducted. Skylar has invested significant time and intellectual effort into the project and its direction aligns closely with the research direction he aims on pursuing for his postgraduate research.
                </p>
                <p>
                  However, beyond academic commitments, Skylar is overwhelmed with a particularly demanding schedule. Final examinations are approaching, and he is concurrently managing family-related obligations that have begun to take up time and emotional capacity. Over the past month, his mother has been diagnosed with Stage Four cancer. As the sole caregiver in a single-parent household, Skylar now finds himself juggling hospital visits, caretaker responsibilities and emotional strain alongside his academic workload. While he has tried to make steady progress on his research, he is increasingly aware of the need to prioritise completing the research within the next 4 months to ensure he is able to graduate on time.
                </p>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="font-semibold mb-2">Time &amp; workload constraints</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>
                      Next 1 month (finals + caregiving): <strong>8–10 hours/week</strong>
                    </li>
                    <li>
                      Following 3 months (post-finals): <strong>up to 36 hours/week</strong>
                    </li>
                    <li>
                      Hard deadline: finish within <strong>4 months</strong> to avoid delaying graduation
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="font-semibold mb-2">Financial constraints (stipend)</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>
                      Current stipend: <strong>$2,000</strong>
                    </li>
                    <li>
                      Minimum target: <strong>$3,500</strong> (rent near hospital + medical support)
                    </li>
                    <li>
                      Benchmarks found: <strong>$4,000–$5,000</strong>; two peers reportedly{' '}
                      <strong>$4,200</strong> and <strong>$4,500</strong>
                    </li>
                  </ul>
                </div>
                <p>
                  <strong>Professor Pablo</strong>, Skylar’s professor, is a well-established expert in his field with a growing research group and a strong publication record. He has been supporting Skylar closely in his research. However, Professor Pablo has proposed to Skylar to pivot his research focus towards a newer and more promising area. While this shift could potentially lead to a more impactful outcome, it also meant redefining its scope, conducting new experiments and extending the timeline required for completion by at least 1 more year. From Skylar’s perspective, this proposal introduces a lot of uncertainty. A sudden shift at this stage may increase his workload, delay his graduation and move him away from the research direction he is genuinely interested in pursuing.
                </p>
                <p>
                  Skylar is strongly committed to graduating on time as a delay in graduation would negatively affect his scholarship status, and potentially pose financial and academic consequences. As such, he is unlikely to accept options that significantly extend his graduation timeline unless sufficient justification or mitigating arrangements are provided.
                </p>
                <p>
                  At the same time, Skylar recognises that Professor Pablo plays a critical role in his academic future, His evaluation will directly influence Skylar’s final grade and his recommendation will be essential for postgraduate applications. Maintaining a positive working relationship is therefore an important consideration.
                </p>
                <p>
                  While Skylar could explore alternatives such as requesting to retain the current scope, researching on a scaled-down version or in more extreme cases, seeking a different supervisor, these options come with risks. Another alternative he has in mind is <strong>Professor Lambert</strong>, who is also a leading figure within the same research field, but he may not be available or willing to take on another student at such a late stage given his tight schedule. Furthermore, changing professors could disrupt continuity and weaken the strength of future recommendations.
                </p>
                <p>
                  The situation has now reached a turning point where both parties must decide how to move forward. Skylar must determine how to respond to the proposed change in direction and how to balance competing priorities under time pressure and uncertainty. As you enter this negotiation, consider not only what outcome you want to achieve, but also how you communicate your constraints, manage the relationship and create possible solutions that could address both your needs and those of your supervisor.
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

      {/* Case Study Modal (shown before objectives) */}
      {showCaseStudy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <div className="text-center mb-5">
                <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                  Case Study — Skylar (Full Role Sheet)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">National University of Singapore</p>
                <p className="text-xs text-muted-foreground italic mt-1">For Role-Playing Purpose Only</p>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground space-y-4">
                <p>
                  You are taking on the role of Skylar, a final-year undergraduate student, in a negotiation with your academic supervisor. Your task is to engage in a conversation to determine the direction and scope of your research project, while balancing your academic goals, personal circumstance and future aspirations.
                </p>
                <p>
                  <strong>Skylar</strong> is a final-year undergraduate enrolled in National University of Singapore and a recipient of the prestigious Presidential Scholarship. Over the past eight months, he has been working closely with <strong>Professor Pablo</strong> on a research study within [understanding blood-flow hemodynamics and properties through mechanical heart valves], a specialised, niche domain of their field. Skylar is the only researcher below 30 years old that is exploring this field in the whole nation. The project is currently at a critical midpoint, with most of the foundational research already completed and preliminary findings conducted. Skylar has invested significant time and intellectual effort into the project and its direction aligns closely with the research direction he aims on pursuing for his postgraduate research.
                </p>
                <p>
                  However, beyond academic commitments, Skylar is overwhelmed with a particularly demanding schedule. Final examinations are approaching, and he is concurrently managing family-related obligations that have begun to take up time and emotional capacity. Over the past month, his mother has been diagnosed with Stage Four cancer. As the sole caregiver in a single-parent household, Skylar now finds himself juggling hospital visits, caretaker responsibilities and emotional strain alongside his academic workload. While he has tried to make steady progress on his research, he is increasingly aware of the need to prioritise completing the research within the next 4 months to ensure he is able to graduate on time.
                </p>
                <p>
                  <strong>Professor Pablo</strong>, Skylar’s professor, is a well-established expert in his field with a growing research group and a strong publication record. He has been supporting Skylar closely in his research. However, Professor Pablo has proposed to Skylar to pivot his research focus towards a newer and more promising area. While this shift could potentially lead to a more impactful outcome, it also meant redefining its scope, conducting new experiments and extending the timeline required for completion by at least 1 more year. From Skylar’s perspective, this proposal introduces a lot of uncertainty. A sudden shift at this stage may increase his workload, delay his graduation and move him away from the research direction he is genuinely interested in pursuing.
                </p>
                <p>
                  Skylar is strongly committed to graduating on time as a delay in graduation would negatively affect his scholarship status, and potentially pose financial and academic consequences. As such, he is unlikely to accept options that significantly extend his graduation timeline unless sufficient justification or mitigating arrangements are provided.
                </p>
                <p>
                  At the same time, Skylar recognises that Professor Pablo plays a critical role in his academic future, His evaluation will directly influence Skylar’s final grade and his recommendation will be essential for postgraduate applications. Maintaining a positive working relationship is therefore an important consideration.
                </p>
                <p>
                  While Skylar could explore alternatives such as requesting to retain the current scope, researching on a scaled-down version or in more extreme cases, seeking a different supervisor, these options come with risks. Another alternative he has in mind is <strong>Professor Lambert</strong>, who is also a leading figure within the same research field, but he may not be available or willing to take on another student at such a late stage given his tight schedule. Furthermore, changing professors could disrupt continuity and weaken the strength of future recommendations.
                </p>
                <p>
                  The situation has now reached a turning point where both parties must decide how to move forward. Skylar must determine how to respond to the proposed change in direction and how to balance competing priorities under time pressure and uncertainty. As you enter this negotiation, consider not only what outcome you want to achieve, but also how you communicate your constraints, manage the relationship and create possible solutions that could address both your needs and those of your supervisor.
                </p>
                <p className="font-medium">
                  Your task is to engage in this conversation strategically and thoughtfully. The success of the negotiation will depend not only on the final agreement reached, but also on your ability to navigate trade-offs, uncover underlying interests and handle the inherent tension between performance, wellbeing and long-term goals.
                </p>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="font-semibold mb-2">Research scope tiers (what you can negotiate for)</p>
                  <p className="text-muted-foreground">
                    Use these tiers to set a clear target. Higher tiers are higher-impact but riskier for graduation and wellbeing.
                  </p>
                  <ul className="space-y-3 mt-3">
                    <li>
                      <strong>Tier 1 — Finish original scope (conservative completion)</strong>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Keep the current heart-valve hemodynamics direction; deliver a strong thesis + defensible results.</li>
                        <li>Requires you to justify feasibility/resources and show reliable commitment.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Tier 2 — “Bridge” pivot (4-month, graduation-safe pivot)</strong>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Accept a narrowed pivot that reuses your existing work and adds minimal new work.</li>
                        <li>Deliverables are time-boxed; insist on clear milestones and support to protect graduation.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Tier 3 — Full pivot (highest impact, highest risk)</strong>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>New experiments and expanded scope; larger research story.</li>
                        <li>High risk of graduation delay unless exceptional arrangements exist.</li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 flex justify-center">
                <Button variant="default" onClick={() => setShowCaseStudy(false)} className="px-6">
                  Close
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
                <Button variant="default" onClick={() => setShowObjectives(false)} className="px-6">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/65 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
        <div className="w-10" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Negotiation Coach</h1>
        </div>
        {messages.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs font-medium"
                title="Open session actions (scenario, concepts, debrief)"
              >
                <Menu className="h-3.5 w-3.5" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[230px]">
              <DropdownMenuLabel className="text-xs">What would you like to do?</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  sendMessage({
                    text: `Continue the negotiation scenario as Professor Pablo. Pick up from our last point and ask a pointed next question.`,
                  })
                }}
              >
                <MessageSquareText className="h-4 w-4" />
                Continue Scenario
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  sendMessage({
                    text: `Please review the key negotiation concepts with me. Explain the 7 elements: Interests, Options, Alternatives (BATNA), Legitimacy, Communication, Relationship, and Commitment.`,
                  })
                }}
              >
                <BookOpen className="h-4 w-4" />
                Review Concepts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCaseStudy(true)}>
                <Eye className="h-4 w-4" />
                View Case Study
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowObjectives(true)}>
                <LayoutGrid className="h-4 w-4" />
                View Objectives
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!finalReportHtml) return
                  setFinalReportSessionAt((t) => t ?? new Date().toLocaleString())
                  setShowFinalReport(true)
                }}
                data-disabled={!finalReportHtml}
              >
                <FileDown className="h-4 w-4" />
                View Final Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setAutoDebriefTriggered(true)
                  setPendingAutoDebrief(false)
                  if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
                  pendingAutoDebriefTimerRef.current = null
                  generateFinalReportNow(messages)
                }}
              >
                <Flag className="h-4 w-4" />
                End Negotiation & Generate Final Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">

          {/* Step 1: Name capture */}
          {!nameSubmitted ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
              <div className="w-full max-w-lg rounded-3xl border bg-background/55 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] p-6 sm:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15 shadow-sm mb-5">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Negotiation Coach
                </h2>
                <p className="text-muted-foreground mt-2">
                  Practise a realistic supervisor negotiation and get structured feedback.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-medium text-foreground mb-2">What&apos;s your name?</p>
                  <form onSubmit={handleNameSubmit} className="flex flex-col items-center gap-3 w-full">
                    <input
                      suppressHydrationWarning
                      ref={nameInputRef}
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g., Skylar"
                      className={cn(
                        'w-full rounded-xl border border-input bg-background/70 px-4 py-3 text-center shadow-sm',
                        'text-foreground placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={!nameInput.trim()}>
                      Continue
                    </Button>
                  </form>
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  Tip: You can end the negotiation anytime and generate a final evaluation report.
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            /* Step 2: Welcome + mode buttons */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/70 border shadow-sm mb-6">
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
                  className="h-auto py-4 px-6 flex-1 max-w-xs shadow-sm"
                  onClick={() => setShowRoleSheet(true)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold">Start Scenario</span>
                    <span className="text-xs opacity-80">Begin the Skylar negotiation case</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 px-6 flex-1 max-w-xs bg-background/60 shadow-sm"
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 max-w-[85%] border shadow-sm',
                      message.role === 'user'
                        ? 'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground border-primary/25'
                        : (() => {
                            const text = message.parts
                              .filter((p) => p.type === 'text')
                              .map((p) => (p as { type: 'text'; text: string }).text)
                              .join('')
                              .toUpperCase()
                            const isWarning = text.includes('WARNING') || text.includes('SESSION ENDED')
                            return isWarning
                              ? 'bg-destructive/10 text-foreground border-destructive/35 backdrop-blur'
                              : 'bg-background/55 text-foreground border-border/70 backdrop-blur'
                          })()
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return (
                            <span key={index} className="whitespace-pre-wrap">
                              {stripConclusionMarker(part.text)}
                            </span>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 border shadow-sm">
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

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input — only show after name is submitted and chat has started */}
      {nameSubmitted && messages.length > 0 && (
        <footer className="border-t border-border/60 bg-background/65 p-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
          {/* Action buttons row */}
          <div className="mx-auto mb-3 flex max-w-3xl items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-background/60 shadow-sm"
              onClick={() => setShowCaseStudy(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Case Study
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-background/60 shadow-sm"
              onClick={() => setShowObjectives(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Objectives
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-medium text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive bg-background/60 shadow-sm"
              onClick={() => {
                setAutoDebriefTriggered(true)
                setPendingAutoDebrief(false)
                if (pendingAutoDebriefTimerRef.current) window.clearTimeout(pendingAutoDebriefTimerRef.current)
                pendingAutoDebriefTimerRef.current = null
                generateFinalReportNow(messages)
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
