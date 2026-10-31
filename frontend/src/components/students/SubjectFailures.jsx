import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ErrorPanel, LoadingBlock } from '../common/Feedback.jsx'
import { useApi } from '../../hooks/useApi.js'
import { getFailures } from '../../lib/api.js'
import { formatNumber, semesterLabel } from '../../lib/format.js'

export default function SubjectFailures({ department, semester, subjects }) {
  const location = useLocation()
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('')
  const topSubject = [...subjects].sort((a, b) => b.failed - a.failed)[0]
  const effectiveSubjectCode = subjects.some(
    (item) => item.subject_code === selectedSubjectCode,
  )
    ? selectedSubjectCode
    : topSubject?.subject_code || ''
  const subject = subjects.find((item) => item.subject_code === effectiveSubjectCode)

  const { data, loading, error, reload } = useApi(
    (signal) =>
      subject
        ? getFailures(
            {
              department,
              semester,
              subject: subject.subject_code,
            },
            signal,
          )
        : Promise.resolve(null),
    [department, semester, subject?.subject_code],
  )

  if (!subject) return null

  return (
    <section aria-labelledby="failure-title" className="mt-10 border-t border-line pt-6 md:pt-7">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label">Failure records · Semester {semesterLabel(semester)}</p>
          <h2
            id="failure-title"
            className="mt-1.5 font-serif text-[1.45rem] leading-tight tracking-[-0.015em] text-ink md:text-[1.6rem]"
          >
            {subject.subject_name}
          </h2>
          <p className="num mt-1 text-[11.5px] text-muted" aria-live="polite">
            {subject.subject_code}
            {data ? ` · ${formatNumber(data.count)} ${data.count === 1 ? 'student' : 'students'}` : ''}
          </p>
        </div>
        <div className="w-full sm:w-[20rem]">
          <label htmlFor="failure-subject" className="label mb-1.5">
            Subject
          </label>
          <select
            id="failure-subject"
            value={effectiveSubjectCode}
            onChange={(event) => setSelectedSubjectCode(event.target.value)}
            className="h-10 w-full rounded-[4px] border border-line bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25"
          >
            {subjects.map((item) => (
              <option key={item.subject_code} value={item.subject_code}>
                {item.subject_code} · {item.subject_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <LoadingBlock label="Loading failed records" />}
      {!loading && error && (
        <ErrorPanel error={error} onRetry={reload} title="Failed records could not be loaded" />
      )}
      {!loading && !error && data && data.count === 0 && (
        <p className="border-y border-line py-8 text-[13px] text-muted">
          No failed records for this subject in Semester {semesterLabel(semester)}.
        </p>
      )}
      {!loading && !error && data && data.count > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">
              Students who failed {data.subject_name} in Semester {semesterLabel(semester)}
            </caption>
            <thead>
              <tr className="border-y border-line">
                <th scope="col" className="label px-3 py-3 font-semibold">Roll number</th>
                <th scope="col" className="label px-3 py-3 font-semibold">Student</th>
                <th scope="col" className="label px-3 py-3 text-right font-semibold">Total</th>
                <th scope="col" className="label px-3 py-3 text-center font-semibold">Grade</th>
                <th scope="col" className="label px-3 py-3 text-right font-semibold">
                  <span className="sr-only">Profile</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.student_id} className="border-b border-line/80 hover:bg-surface/70">
                  <td className="num whitespace-nowrap px-3 py-3 text-[12.5px] text-muted">
                    {item.roll_number}
                  </td>
                  <td className="px-3 py-3 text-[13px] font-medium text-ink">{item.student_name}</td>
                  <td className="num px-3 py-3 text-right text-[13px] text-ink-soft">
                    {item.total_marks}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">
                      {item.grade}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to={`/students/${item.student_id}`}
                      state={{
                        from: `${location.pathname}${location.search}`,
                        mode: 'department',
                      }}
                      aria-label={`Open profile for ${item.student_name}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-forest underline decoration-forest/25 underline-offset-4 hover:decoration-forest"
                    >
                      View
                      <span aria-hidden="true">→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
