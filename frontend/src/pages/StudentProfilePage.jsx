import { Link, useLocation, useParams } from 'react-router-dom'
import { ErrorPanel, LoadingBlock, MetricSkeleton } from '../components/common/Feedback.jsx'
import MetricStrip from '../components/common/MetricStrip.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import Section from '../components/common/Section.jsx'
import StatusBadge from '../components/common/StatusBadge.jsx'
import { useApi } from '../hooks/useApi.js'
import {
  getStudent,
  getStudentComparison,
  getStudentResults,
} from '../lib/api.js'
import {
  formatCgpa,
  formatNumber,
  plural,
  semesterLabel,
} from '../lib/format.js'

function signed(value, digits = 2) {
  const number = Number(value) || 0
  const prefix = number > 0 ? '+' : ''
  return `${prefix}${formatNumber(number, digits)}`
}

export default function StudentProfilePage() {
  const { studentId } = useParams()
  const location = useLocation()
  const profileApi = useApi((signal) => getStudent(studentId, signal), [studentId])
  const resultsApi = useApi(
    (signal) => getStudentResults(studentId, undefined, signal),
    [studentId],
  )
  const comparisonApi = useApi(
    (signal) => getStudentComparison(studentId, signal),
    [studentId],
  )

  const profile = profileApi.data
  const student = profile?.student
  const mode =
    location.state?.mode ||
    (student?.department_code ? 'department' : 'principal')
  const fallbackFrom =
    mode === 'department' && student?.department_code
      ? `/department/${student.department_code}`
      : '/principal'
  const from = location.state?.from || fallbackFrom
  const backLabel =
    mode === 'department' ? 'Back to branch register' : 'Back to college register'

  const latest = profile?.summaries?.[profile.summaries.length - 1]
  const creditsEarned = (profile?.summaries || []).reduce(
    (sum, item) => sum + item.credits_earned,
    0,
  )
  const failedBySemester = (resultsApi.data?.semesters || [])
    .filter((item) => item.failed_subjects.length > 0)
    .map((item) => ({
      semester: item.semester,
      subjects: item.failed_subjects,
    }))

  const metrics = profile
    ? [
        {
          label: 'Cumulative CGPA',
          value: formatCgpa(latest?.cgpa),
          note: `Through Semester ${semesterLabel(latest?.semester)}`,
        },
        {
          label: `Semester ${semesterLabel(latest?.semester)} result`,
          value: latest?.result_status === 'PASS' ? 'Pass' : 'Fail',
          note: `SGPA ${formatCgpa(latest?.sgpa)}`,
        },
        {
          label: 'Credits earned',
          value: formatNumber(creditsEarned),
          note: `Across ${plural(profile.summaries.length, 'semester')}`,
        },
        {
          label: 'Current backlogs',
          value: formatNumber(profile.overall_backlog_count),
          note:
            profile.overall_backlog_count > 0
              ? 'Failed subjects across semesters'
              : 'No failed subjects on record',
        },
      ]
    : []

  if (profileApi.loading) {
    return <LoadingBlock label="Loading student record" />
  }

  if (profileApi.error) {
    return (
      <div className="page-enter">
        <Link
          to={fallbackFrom}
          className="text-[12.5px] font-medium text-muted underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest"
        >
          {backLabel}
        </Link>
        <div className="mt-6">
          <ErrorPanel
            error={profileApi.error}
            onRetry={profileApi.reload}
            title="Student record could not be loaded"
          />
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="page-enter">
      <Link
        to={from}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-forest hover:decoration-forest"
      >
        <span aria-hidden="true">←</span>
        {backLabel}
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={`${student.department_code} · Student record`}
          title={student.name}
          description={`${student.roll_number} · Section ${student.section} · ${student.department_name}`}
          action={
            <div className="text-left sm:text-right">
              <p className="label mb-1.5">Overall result</p>
              <StatusBadge status={profile.overall_result_status} />
            </div>
          }
        />
      </div>

      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
        <a
          href={`mailto:${student.email}`}
          className="underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest"
        >
          {student.email}
        </a>
        <span aria-hidden="true">·</span>
        <span>{student.status}</span>
        <span aria-hidden="true">·</span>
        <span>Admitted {student.admission_year}</span>
      </div>

      <div className="mt-4">
        {profileApi.loading && <MetricSkeleton />}
        {profile && <MetricStrip items={metrics} />}
      </div>

      {profile.overall_backlog_count > 0 && (
        <div className="mt-6 border-y border-line py-4">
          <p className="label text-danger">
            {profile.overall_backlog_count}{' '}
            {plural(profile.overall_backlog_count, 'current backlog')}
          </p>
          {resultsApi.loading && (
            <p className="mt-1.5 text-[12.5px] text-muted">Reading failed subjects…</p>
          )}
          {resultsApi.error && (
            <p className="mt-1.5 text-[12.5px] text-muted">
              Failed subject detail is temporarily unavailable.
            </p>
          )}
          {!resultsApi.loading && !resultsApi.error && failedBySemester.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-soft">
              {failedBySemester.map((item) => (
                <li key={item.semester}>
                  <span className="font-medium text-ink">
                    Semester {semesterLabel(item.semester)}:
                  </span>{' '}
                  {item.subjects.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section
        eyebrow="Movement"
        title="Across semesters"
        className="mt-9"
        action={
          comparisonApi.data?.delta ? (
            <p className="num text-[11.5px] text-muted">
              Semester {semesterLabel(comparisonApi.data.semesters[0]?.semester)} to{' '}
              {semesterLabel(comparisonApi.data.semesters.at(-1)?.semester)}
            </p>
          ) : null
        }
      >
        {comparisonApi.loading && <LoadingBlock label="Comparing semesters" />}
        {!comparisonApi.loading && comparisonApi.error && (
          <ErrorPanel
            error={comparisonApi.error}
            onRetry={comparisonApi.reload}
            title="Semester comparison could not be loaded"
          />
        )}
        {!comparisonApi.loading && !comparisonApi.error && comparisonApi.data && (
          <div>
            <dl className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
              {[
                {
                  label: 'SGPA change',
                  value: signed(comparisonApi.data.delta?.sgpa),
                  positive: (comparisonApi.data.delta?.sgpa || 0) >= 0,
                },
                {
                  label: 'CGPA change',
                  value: signed(comparisonApi.data.delta?.cgpa),
                  positive: (comparisonApi.data.delta?.cgpa || 0) >= 0,
                },
                {
                  label: 'Credits added',
                  value: signed(comparisonApi.data.delta?.credits_earned, 0),
                  positive: (comparisonApi.data.delta?.credits_earned || 0) >= 0,
                },
                {
                  label: 'Backlog change',
                  value: signed(comparisonApi.data.delta?.backlog_count, 0),
                  positive: (comparisonApi.data.delta?.backlog_count || 0) <= 0,
                },
              ].map((item) => (
                <div key={item.label} className="bg-paper px-4 py-4">
                  <dt className="label text-[10px]">{item.label}</dt>
                  <dd
                    className={`num mt-2 text-[1.3rem] font-semibold leading-none ${
                      item.positive ? 'text-forest' : 'text-danger'
                    }`}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <caption className="sr-only">Semester summary comparison</caption>
                <thead>
                  <tr className="border-y border-line">
                    <th scope="col" className="label px-3 py-3 font-semibold">Semester</th>
                    <th scope="col" className="label px-3 py-3 text-right font-semibold">SGPA</th>
                    <th scope="col" className="label px-3 py-3 text-right font-semibold">CGPA</th>
                    <th scope="col" className="label px-3 py-3 text-right font-semibold">Credits</th>
                    <th scope="col" className="label px-3 py-3 text-right font-semibold">Backlogs</th>
                    <th scope="col" className="label px-3 py-3 text-center font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonApi.data.semesters.map((item) => (
                    <tr key={item.semester} className="border-b border-line/80">
                      <td className="px-3 py-3 text-[13px] font-medium text-ink">
                        Semester {semesterLabel(item.semester)}
                      </td>
                      <td className="num px-3 py-3 text-right text-[13px] text-ink-soft">
                        {formatCgpa(item.sgpa)}
                      </td>
                      <td className="num px-3 py-3 text-right text-[13px] text-ink-soft">
                        {formatCgpa(item.cgpa)}
                      </td>
                      <td className="num px-3 py-3 text-right text-[13px] text-ink-soft">
                        {formatNumber(item.credits_earned)}
                      </td>
                      <td className="num px-3 py-3 text-right text-[13px] text-ink-soft">
                        {formatNumber(item.backlog_count)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={item.result_status} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        eyebrow="Subject record"
        title="Semester results"
        className="mt-9"
      >
        {resultsApi.loading && <LoadingBlock label="Loading subject results" />}
        {!resultsApi.loading && resultsApi.error && (
          <ErrorPanel
            error={resultsApi.error}
            onRetry={resultsApi.reload}
            title="Subject results could not be loaded"
          />
        )}
        {!resultsApi.loading && !resultsApi.error && (
          <div className="grid gap-9 lg:grid-cols-2">
            {resultsApi.data?.semesters.map((semester) => (
              <article key={semester.semester}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="label">Semester {semesterLabel(semester.semester)}</p>
                    <h3 className="mt-1 font-serif text-[1.3rem] tracking-[-0.015em] text-ink">
                      {semester.academic_year}
                    </h3>
                    <p className="num mt-1 text-[11.5px] text-muted">
                      SGPA {formatCgpa(semester.sgpa)} · CGPA {formatCgpa(semester.cgpa)}
                    </p>
                  </div>
                  <StatusBadge status={semester.result_status} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <caption className="sr-only">
                      Subject results for Semester {semesterLabel(semester.semester)}
                    </caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="label py-2.5 pr-2 font-semibold">Subject</th>
                        <th scope="col" className="label px-2 py-2.5 text-right font-semibold">Credits</th>
                        <th scope="col" className="label px-2 py-2.5 text-right font-semibold">Internal</th>
                        <th scope="col" className="label px-2 py-2.5 text-right font-semibold">External</th>
                        <th scope="col" className="label px-2 py-2.5 text-right font-semibold">Total</th>
                        <th scope="col" className="label px-2 py-2.5 text-center font-semibold">Grade</th>
                        <th scope="col" className="label py-2.5 pl-2 text-center font-semibold">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semester.subjects.map((subject) => (
                        <tr
                          key={subject.subject_code}
                          className={`border-b border-line/70 ${
                            subject.result_status === 'FAIL' ? 'bg-danger-soft/25' : ''
                          }`}
                        >
                          <td className="py-2.5 pr-2">
                            <span className="num block text-[9.5px] tracking-[0.04em] text-muted">
                              {subject.subject_code}
                            </span>
                            <span className="mt-0.5 block text-[12px] font-medium text-ink">
                              {subject.subject_name}
                            </span>
                          </td>
                          <td className="num px-2 py-2.5 text-right text-[12px] text-ink-soft">
                            {subject.credits}
                          </td>
                          <td className="num px-2 py-2.5 text-right text-[12px] text-ink-soft">
                            {subject.internal_marks}
                          </td>
                          <td className="num px-2 py-2.5 text-right text-[12px] text-ink-soft">
                            {subject.external_marks}
                          </td>
                          <td className="num px-2 py-2.5 text-right text-[12px] font-semibold text-ink">
                            {subject.total_marks}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[10.5px] font-semibold ${
                                subject.result_status === 'FAIL'
                                  ? 'bg-danger-soft text-danger'
                                  : 'bg-forest-soft text-forest'
                              }`}
                            >
                              {subject.grade}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 text-center">
                            <StatusBadge status={subject.result_status} compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="num mt-2.5 text-[10.5px] text-muted">
                  {formatNumber(semester.credits_earned)} of{' '}
                  {formatNumber(semester.credits_registered)} credits earned ·{' '}
                  {formatNumber(semester.semester_backlog_count)}{' '}
                  {plural(semester.semester_backlog_count, 'backlog')} this semester
                </p>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
