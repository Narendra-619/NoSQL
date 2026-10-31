import { useState } from 'react'

import { ErrorPanel, LoadingBlock } from '../common/Feedback.jsx'
import { useApi } from '../../hooks/useApi.js'
import { getAdminFailures } from '../../lib/api.js'
import { formatNumber, plural } from '../../lib/format.js'
import { inputClass, smallButton } from './adminStyles.js'
import ResultEditor from './ResultEditor.jsx'

function Metric({ label, value, note }) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="label text-[10px]">{label}</p>
      <p className="num mt-1.5 text-[1.45rem] font-semibold leading-none text-ink">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-muted">{note}</p>
    </div>
  )
}

export default function AdminResultsTab({
  adminKey,
  branch,
  semester,
  meta,
}) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  const failuresApi = useApi(
    (signal) =>
      getAdminFailures({ department: branch, semester }, adminKey, signal),
    [branch, semester, adminKey],
  )

  const allItems = failuresApi.data?.items || []
  const term = search.trim().toLowerCase()
  const items = term
    ? allItems.filter(
        (item) =>
          item.roll_number.toLowerCase().includes(term) ||
          item.student_name.toLowerCase().includes(term) ||
          item.subject_code.toLowerCase().includes(term) ||
          item.subject_name.toLowerCase().includes(term),
      )
    : allItems
  const studentCount = new Set(allItems.map((item) => item.student_id)).size
  const subjectCount = new Set(allItems.map((item) => item.subject_code)).size

  function saved(result) {
    setNotice(
      `${result.result.subject_code} for ${result.result.roll_number} was corrected. SGPA ${result.before.sgpa} → ${result.after.sgpa}; backlogs ${result.before.backlog_count} → ${result.after.backlog_count}.`,
    )
    failuresApi.reload()
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Failed-result maintenance</p>
          <h2 className="mt-1.5 font-serif text-[1.6rem] leading-tight tracking-[-0.02em] text-ink">
            Corrections in {branch}
          </h2>
          <p className="num mt-1.5 text-[11.5px] text-muted">
            Semester {semester} · corrections recompute SGPA, CGPA, and backlog
            counts immediately
          </p>
        </div>
        <p className="max-w-xs text-right text-[11.5px] leading-relaxed text-muted">
          Only failed subjects are listed. Each correction is recorded against the
          before and after summary snapshots.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mt-5 flex flex-wrap items-start justify-between gap-3 border-l-2 border-success bg-forest-soft/45 px-4 py-3"
        >
          <p className="text-[12.5px] text-forest">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-[11px] font-medium text-forest underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-px border-y border-line bg-line">
        <Metric
          label="Failed results"
          value={formatNumber(allItems.length)}
          note={`${plural(allItems.length, 'subject attempt')} at Semester ${semester}`}
        />
        <Metric
          label="Students affected"
          value={formatNumber(studentCount)}
          note={`${plural(studentCount, 'student')} in ${branch}`}
        />
        <Metric
          label="Subjects involved"
          value={formatNumber(subjectCount)}
          note={`${plural(subjectCount, 'subject')} requiring correction`}
        />
      </div>

      <div className="mt-5 w-full max-w-sm">
        <label htmlFor="admin-result-search" className="label mb-1.5 block">
          Search roll, student, or subject
        </label>
        <input
          id="admin-result-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search failed results"
          className={inputClass}
        />
      </div>

      {failuresApi.loading && <LoadingBlock label="Loading failed results" />}
      {!failuresApi.loading && failuresApi.error && (
        <ErrorPanel
          error={failuresApi.error}
          onRetry={failuresApi.reload}
          title="Failed results could not be loaded"
        />
      )}
      {!failuresApi.loading && !failuresApi.error && items.length === 0 && (
        <div className="mt-5 border-y border-line py-10">
          <p className="label">No failed results</p>
          <h3 className="mt-2 font-serif text-xl text-ink">
            {term
              ? 'No failed results match this search'
              : `Semester ${semester} is clear for ${branch}`}
          </h3>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">
            {term
              ? 'Clear the search to return to the full failed-result register.'
              : 'Every recorded subject attempt in this branch and semester is currently a pass.'}
          </p>
        </div>
      )}
      {!failuresApi.loading && !failuresApi.error && items.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line">
                <th className="label px-3 py-3 font-semibold">Roll number</th>
                <th className="label px-3 py-3 font-semibold">Student</th>
                <th className="label px-3 py-3 font-semibold">Subject</th>
                <th className="label px-3 py-3 text-right font-semibold">Internal</th>
                <th className="label px-3 py-3 text-right font-semibold">External</th>
                <th className="label px-3 py-3 text-right font-semibold">Total</th>
                <th className="label px-3 py-3 font-semibold">Grade</th>
                <th className="label px-3 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.student_id}-${item.semester}-${item.subject_code}`}
                  className="border-b border-line/80 transition-colors hover:bg-surface/70"
                >
                  <td className="num whitespace-nowrap px-3 py-3.5 text-[11.5px] text-muted">
                    {item.roll_number}
                  </td>
                  <td className="px-3 py-3.5 text-[13px] font-medium text-ink">
                    {item.student_name || 'Unnamed student'}
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="text-[12.5px] text-ink">{item.subject_name}</p>
                    <p className="num mt-0.5 text-[10.5px] text-muted">
                      {item.subject_code} · {item.credits} credits
                    </p>
                  </td>
                  <td className="num px-3 py-3.5 text-right text-[12.5px] text-ink-soft">
                    {formatNumber(item.internal_marks)}
                    <span className="text-[10px] text-muted">/{item.internal_max}</span>
                  </td>
                  <td className="num px-3 py-3.5 text-right text-[12.5px] text-ink-soft">
                    {formatNumber(item.external_marks)}
                    <span className="text-[10px] text-muted">/{item.external_max}</span>
                  </td>
                  <td className="num px-3 py-3.5 text-right text-[13px] font-semibold text-danger">
                    {formatNumber(item.total_marks)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span className="rounded-full border border-danger/25 bg-danger-soft/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-danger">
                      {item.grade} · {item.result_status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className={smallButton}
                    >
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num mt-2.5 text-[10.5px] text-muted">
            Showing {formatNumber(items.length)} of {formatNumber(allItems.length)}{' '}
            {plural(allItems.length, 'failed result')}. Pass mark is 40/100.
          </p>
        </div>
      )}

      {editing && (
        <ResultEditor
          item={editing}
          meta={meta}
          adminKey={adminKey}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
