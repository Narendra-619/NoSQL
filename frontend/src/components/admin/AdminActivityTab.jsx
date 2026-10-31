import { useState } from 'react'

import { ErrorPanel, LoadingBlock } from '../common/Feedback.jsx'
import { useApi } from '../../hooks/useApi.js'
import { getAdminAudit } from '../../lib/api.js'
import { formatCgpa, formatNumber, plural } from '../../lib/format.js'
import AdminDialog from './AdminDialog.jsx'
import { inputClass, secondaryButton, smallButton } from './adminStyles.js'

const actionLabels = {
  'student.create': 'Student created',
  'student.update': 'Profile updated',
  'student.delete': 'Student deleted',
  'result.correct': 'Result corrected',
  'result.backlog_clear': 'Backlogs cleared',
}

const fieldLabels = {
  student_id: 'Student ID',
  roll_number: 'Roll number',
  name: 'Name',
  department_code: 'Branch code',
  department_name: 'Branch',
  section: 'Section',
  admission_year: 'Admission year',
  year_of_study: 'Year of study',
  current_semester: 'Current semester',
  email: 'Email',
  status: 'Status',
  record_source: 'Record source',
  created_at: 'Created',
  updated_at: 'Updated',
  semester: 'Semester',
  subject_code: 'Subject code',
  subject_name: 'Subject',
  internal_marks: 'Internal marks',
  external_marks: 'External marks',
  total_marks: 'Total marks',
  result_status: 'Result status',
  sgpa: 'SGPA',
  cgpa: 'CGPA',
  backlog_count: 'Backlogs',
  overall_backlog_count: 'Overall backlogs',
  cleared_subjects: 'Cleared subjects',
}

const fieldOrder = [
  'roll_number',
  'name',
  'student_id',
  'department_code',
  'department_name',
  'section',
  'admission_year',
  'year_of_study',
  'current_semester',
  'status',
  'email',
  'record_source',
  'semester',
  'subject_code',
  'subject_name',
  'internal_marks',
  'external_marks',
  'total_marks',
  'result_status',
  'sgpa',
  'cgpa',
  'backlog_count',
  'overall_backlog_count',
  'cleared_subjects',
  'created_at',
  'updated_at',
]

function actionLabel(action) {
  return actionLabels[action] || action || 'Unknown action'
}

function sourceLabel(source) {
  if (source === 'manual') return 'Manual'
  if (source === 'simulated') return 'Simulated'
  if (source === 'seed') return 'Seeded'
  return source || '—'
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function actionBadge(action) {
  if (action === 'student.delete') {
    return 'border-danger/25 bg-danger-soft/35 text-danger'
  }
  if (
    action === 'student.create' ||
    action === 'result.correct' ||
    action === 'result.backlog_clear'
  ) {
    return 'border-forest/25 bg-forest-soft/45 text-forest'
  }
  return 'border-line-strong bg-surface text-ink-soft'
}

function flattenSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {}
  if (snapshot.identity && typeof snapshot.identity === 'object') {
    return {
      ...snapshot.identity,
      overall_backlog_count: snapshot.overall_backlog_count,
    }
  }
  return snapshot
}

function fieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'sgpa' || key === 'cgpa') return formatCgpa(value)
  if (
    key === 'internal_marks' ||
    key === 'external_marks' ||
    key === 'total_marks' ||
    key === 'backlog_count' ||
    key === 'overall_backlog_count'
  ) {
    return formatNumber(value)
  }
  if (key === 'created_at' || key === 'updated_at') return formatTimestamp(value)
  return String(value)
}

function Snapshot({ title, snapshot, compareTo, highlightChanges }) {
  const values = flattenSnapshot(snapshot)
  const compareValues = flattenSnapshot(compareTo)
  const keys = fieldOrder.filter(
    (key) =>
      values[key] !== undefined ||
      (highlightChanges && compareValues[key] !== undefined),
  )
  if (keys.length === 0) return null

  return (
    <section>
      <h3 className="label">{title}</h3>
      <dl className="mt-2 divide-y divide-line/70 border-y border-line">
        {keys.map((key) => {
          const changed =
            highlightChanges &&
            String(values[key] ?? '') !== String(compareValues[key] ?? '')
          return (
            <div
              key={key}
              className="grid grid-cols-[8.5rem_1fr] items-baseline gap-3 py-2"
            >
              <dt className="text-[11px] text-muted">
                {fieldLabels[key] || key}
              </dt>
              <dd
                className={`num min-w-0 break-words text-[12px] ${
                  changed ? 'font-semibold text-forest' : 'text-ink'
                }`}
              >
                {fieldValue(key, values[key])}
                {changed && (
                  <span className="ml-2 text-[9.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    changed
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function AuditEntryDialog({ entry, onClose }) {
  const before = entry.before || null
  const after = entry.after || null
  const hasBoth = Boolean(before && after)

  return (
    <AdminDialog
      eyebrow="Audit entry"
      title={`${actionLabel(entry.action)} · ${entry.roll_number || 'System'}`}
      description={entry.summary}
      size="lg"
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          ['Recorded', formatTimestamp(entry.created_at)],
          ['Entity', entry.entity_type || '—'],
          ['Roll number', entry.roll_number || '—'],
          ['Source', sourceLabel(entry.record_source)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-3.5 py-3">
            <p className="label text-[9.5px]">{label}</p>
            <p className="num mt-1.5 break-words text-[11.5px] text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {before && (
          <Snapshot
            title={hasBoth ? 'Before' : 'Removed record'}
            snapshot={before}
            compareTo={after}
            highlightChanges={hasBoth}
          />
        )}
        {after && (
          <Snapshot
            title={hasBoth ? 'After' : 'Created record'}
            snapshot={after}
            compareTo={before}
            highlightChanges={hasBoth}
          />
        )}
        {!before && !after && (
          <p className="text-[13px] text-muted">
            This audit entry does not include a record snapshot.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end border-t border-line pt-5">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close
        </button>
      </div>
    </AdminDialog>
  )
}

export default function AdminActivityTab({ adminKey, onLock }) {
  const [limit, setLimit] = useState(50)
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const auditApi = useApi(
    (signal) => getAdminAudit(adminKey, limit, signal),
    [adminKey, limit],
  )

  const allItems = auditApi.data?.items || []
  const term = search.trim().toLowerCase()
  const items = allItems.filter((entry) => {
    if (action !== 'all' && entry.action !== action) return false
    if (!term) return true
    return [entry.roll_number, entry.summary, entry.action, entry.record_source]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })
  const deleteCount = allItems.filter(
    (entry) => entry.action === 'student.delete',
  ).length

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Immutable operational history</p>
          <h2 className="mt-1.5 font-serif text-[1.6rem] leading-tight tracking-[-0.02em] text-ink">
            Admin activity
          </h2>
          <p className="num mt-1.5 text-[11.5px] text-muted">
            Latest {formatNumber(allItems.length)} actions across every branch ·
            including {formatNumber(deleteCount)}{' '}
            {plural(deleteCount, 'permanent deletion')}
          </p>
        </div>
        <button
          type="button"
          onClick={auditApi.reload}
          disabled={auditApi.loading}
          className={secondaryButton}
        >
          {auditApi.loading ? 'Refreshing…' : 'Refresh trail'}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="audit-search" className="label mb-1.5 block">
            Search roll, action, or summary
          </label>
          <input
            id="audit-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search audit trail"
            className={inputClass}
          />
        </div>
        <div className="w-full max-w-[13rem]">
          <label htmlFor="audit-action" className="label mb-1.5 block">
            Action
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className={inputClass}
          >
            <option value="all">All actions</option>
            <option value="student.create">Student created</option>
            <option value="student.update">Profile updated</option>
            <option value="student.delete">Student deleted</option>
            <option value="result.correct">Result corrected</option>
            <option value="result.backlog_clear">Backlogs cleared</option>
          </select>
        </div>
        <div className="w-full max-w-[9rem]">
          <label htmlFor="audit-limit" className="label mb-1.5 block">
            Show
          </label>
          <select
            id="audit-limit"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className={inputClass}
          >
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
          </select>
        </div>
      </div>

      {auditApi.loading && <LoadingBlock label="Loading audit trail" />}
      {!auditApi.loading && auditApi.error && (
        <ErrorPanel
          error={auditApi.error}
          onRetry={auditApi.error.status === 401 ? onLock : auditApi.reload}
          title={
            auditApi.error.status === 401
              ? 'Admin passcode was rejected'
              : 'Audit trail could not be loaded'
          }
        />
      )}
      {!auditApi.loading && !auditApi.error && items.length === 0 && (
        <div className="mt-5 border-y border-line py-10">
          <p className="label">No activity</p>
          <h3 className="mt-2 font-serif text-xl text-ink">
            {term || action !== 'all'
              ? 'No audit entries match these filters'
              : 'No admin changes recorded yet'}
          </h3>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">
            {term || action !== 'all'
              ? 'Clear the search and action filters to see the complete trail.'
              : 'Creating, editing, correcting, or deleting a student will add an immutable entry here.'}
          </p>
        </div>
      )}
      {!auditApi.loading && !auditApi.error && items.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line">
                <th className="label px-3 py-3 font-semibold">Recorded</th>
                <th className="label px-3 py-3 font-semibold">Action</th>
                <th className="label px-3 py-3 font-semibold">Roll number</th>
                <th className="label px-3 py-3 font-semibold">Summary</th>
                <th className="label px-3 py-3 font-semibold">Source</th>
                <th className="label px-3 py-3 text-right font-semibold">
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-line/80 transition-colors hover:bg-surface/70"
                >
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <p className="num text-[11.5px] text-ink-soft">
                      {formatTimestamp(entry.created_at)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${actionBadge(entry.action)}`}
                    >
                      {actionLabel(entry.action)}
                    </span>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-3.5 text-[11.5px] text-muted">
                    {entry.roll_number || '—'}
                  </td>
                  <td className="max-w-[30rem] px-3 py-3.5 text-[12.5px] leading-relaxed text-ink-soft">
                    {entry.summary || 'No summary recorded.'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-[11px] text-muted">
                    {sourceLabel(entry.record_source)}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(entry)}
                      className={smallButton}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num mt-2.5 text-[10.5px] text-muted">
            Showing {formatNumber(items.length)} of {formatNumber(allItems.length)}{' '}
            {plural(allItems.length, 'audit entry', 'audit entries')}. Newest first.
          </p>
        </div>
      )}

      {selected && (
        <AuditEntryDialog entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
