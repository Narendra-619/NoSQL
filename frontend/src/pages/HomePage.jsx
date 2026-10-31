import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader.jsx'

const modes = [
  {
    index: '01',
    eyebrow: 'College-wide',
    title: 'Principal',
    description:
      'Institution results, branch comparison, and the complete student register.',
    to: '/principal',
    className:
      'border-paper/15 bg-forest text-paper hover:bg-forest-deep focus-visible:outline-paper',
    muted: 'text-paper/60',
    body: 'text-paper/75',
    rule: 'border-paper/25 text-paper',
  },
  {
    index: '02',
    eyebrow: 'Branch-level',
    title: 'Branch',
    description:
      'Semester performance, subject outcomes, failure records, and branch registers.',
    to: '/department',
    className:
      'border-line bg-surface text-ink hover:bg-paper focus-visible:outline-forest',
    muted: 'text-muted',
    body: 'text-muted',
    rule: 'border-line text-forest',
  },
  {
    index: '03',
    eyebrow: 'Restricted',
    title: 'Admin',
    description:
      'Create full academic records, correct results, maintain students, and review the audit trail.',
    to: '/admin',
    className:
      'border-paper/15 bg-ink text-paper hover:bg-forest-deep focus-visible:outline-paper',
    muted: 'text-paper/55',
    body: 'text-paper/70',
    rule: 'border-paper/25 text-paper',
  },
]

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col justify-center py-12 md:py-20"
    >
      <div className="wrap page-enter">
        <PageHeader
          eyebrow="Student academic system"
          title="Academic performance"
          description="Choose a workspace to view institution-wide results, branch-level performance, or administer academic records."
        />

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {modes.map((mode) => (
            <Link
              key={mode.title}
              to={mode.to}
              className={`group flex min-h-[14rem] flex-col justify-between border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-32px_rgba(20,52,40,0.55)] focus-visible:outline-offset-4 md:min-h-[18rem] md:p-7 ${mode.className}`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-[10.5px] font-semibold uppercase tracking-[0.16em] ${mode.muted}`}
                >
                  {mode.eyebrow}
                </p>
                <span className={`num text-[10.5px] tracking-[0.12em] ${mode.muted}`}>
                  {mode.index}
                </span>
              </div>

              <div className="py-8 md:py-10">
                <h2 className="font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[0.95] tracking-[-0.04em]">
                  {mode.title}
                </h2>
                <p
                  className={`mt-4 max-w-sm text-[13px] leading-relaxed md:text-[13.5px] ${mode.body}`}
                >
                  {mode.description}
                </p>
              </div>

              <div
                className={`flex items-center justify-between border-t pt-4 text-[12.5px] font-medium ${mode.rule}`}
              >
                <span>Open module</span>
                <span
                  aria-hidden="true"
                  className="text-[16px] transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
