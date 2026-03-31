'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
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
  const [debriefStarted, setDebriefStarted] = useState(false)
  const [finalReportHtml, setFinalReportHtml] = useState<string | null>(null)
  const [finalReportGenerating, setFinalReportGenerating] = useState(false)
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
    if (!debriefStarted) return
    if (finalReportHtml || finalReportGenerating) return

    const triggerIndex = messages.findIndex((m) => {
      if (m.role !== 'user') return false
      const text = m.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('')
        .trim()
      return text === 'END_DEBRIEF_TRIGGER'
    })
    if (triggerIndex === -1) return

    const userAnswersCount = messages
      .slice(triggerIndex + 1)
      .filter((m) => m.role === 'user')
      .map((m) =>
        m.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
          .trim()
      )
      .filter((t) => t.length > 0).length

    if (userAnswersCount < 3) return

    setFinalReportGenerating(true)
    fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userName, messages }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to generate report')
        const data = (await res.json()) as { html: string }
        setFinalReportHtml(data.html)
      })
      .catch(() => {
        // If report generation fails, we still let them download the plain transcript report.
        setFinalReportHtml(null)
      })
      .finally(() => setFinalReportGenerating(false))
  }, [debriefStarted, finalReportHtml, finalReportGenerating, messages, userName])

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
      setDebriefStarted(true)
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

    const coachingSection = finalReportHtml
      ? `<div class="card" style="margin-top:14px">
           <h2>Evaluation summary</h2>
           ${finalReportHtml}
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
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="w-10" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDebriefStarted(true)
                  sendMessage({ text: 'END_DEBRIEF_TRIGGER' })
                }}
              >
                <Flag className="h-4 w-4" />
                End Negotiation & Start Debrief
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
              onClick={() => setShowCaseStudy(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Case Study
            </Button>
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
                setDebriefStarted(true)
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
          {debriefStarted && !isLoading && (
            <div className="mx-auto mt-3 max-w-3xl flex flex-col items-center gap-1">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 font-medium"
                  onClick={downloadFinalReport}
                >
                  <FileDown className="h-4 w-4" />
                  Download Final Report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 font-medium"
                  onClick={downloadTranscript}
                >
                  <Download className="h-4 w-4" />
                  Download Transcript (.txt)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The final report is a styled HTML file you can print/save as PDF.
              </p>
            </div>
          )}
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            AI may produce inaccurate information. Consider checking important facts.
          </p>
        </footer>
      )}
    </div>
  )
}
