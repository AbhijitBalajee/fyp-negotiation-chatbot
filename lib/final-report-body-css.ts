/**
 * Shared typography for evaluation HTML (in-app + downloaded report).
 * Keep in sync with globals.css `.final-report-html` rules.
 */
export const FINAL_REPORT_BODY_CSS = `
.final-report-html {
  font-size: 0.9375rem;
  line-height: 1.65;
  color: #e5e7eb;
}
.final-report-html h3 {
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #f8fafc;
}
.final-report-html h3.fr-title {
  font-size: 1.2rem;
  letter-spacing: 0.05em;
  margin: 0 0 1rem 0;
  padding-bottom: 0.55rem;
  border-bottom: 2px solid rgba(96, 165, 250, 0.35);
}
.final-report-html h3.fr-section {
  font-size: 1.05rem;
  margin: 1.85rem 0 0.75rem 0;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
}
.final-report-html h3.fr-section:first-of-type,
.final-report-html h3.fr-title + h3.fr-section {
  margin-top: 1.25rem;
}
.final-report-html h3.fr-meta {
  font-size: 0.98rem;
  margin: 1.75rem 0 0.65rem 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
}
.final-report-html h3:not([class]) {
  font-size: 1.02rem;
  margin: 1.5rem 0 0.65rem 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}
.final-report-html p {
  margin: 0 0 0.85rem 0;
  line-height: 1.65;
}
.final-report-html p strong {
  color: #93c5fd;
  font-weight: 600;
}
.final-report-html ul {
  margin: 0.35rem 0 1.35rem 0;
  padding-left: 0;
  list-style: none;
}
.final-report-html li {
  position: relative;
  margin: 0 0 0.7rem 0;
  padding-left: 1.15rem;
  line-height: 1.6;
  color: #e5e7eb;
}
.final-report-html li::before {
  content: "";
  position: absolute;
  left: 0.15rem;
  top: 0.55em;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.85);
}
.final-report-html li strong {
  color: #f1f5f9;
  font-weight: 600;
}
.final-report-html table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0 1.75rem 0;
  font-size: 0.875rem;
}
.final-report-html th,
.final-report-html td {
  border: 1px solid rgba(148, 163, 184, 0.22);
  padding: 0.65rem 0.85rem;
  text-align: left;
  vertical-align: top;
}
.final-report-html th {
  background: rgba(15, 23, 42, 0.95);
  font-weight: 600;
  color: #cbd5e1;
}
.final-report-html td strong {
  color: #e5e7eb;
}
.final-report-html blockquote {
  margin: 1rem 0 1.25rem 0;
  padding: 0.85rem 1rem 0.85rem 1rem;
  border-left: 3px solid #60a5fa;
  background: rgba(148, 163, 184, 0.08);
  border-radius: 0 10px 10px 0;
  font-style: italic;
  color: #cbd5e1;
  line-height: 1.55;
}
`
