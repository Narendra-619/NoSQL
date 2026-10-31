import { useState } from 'react'

import { ErrorPanel, LoadingBlock } from '../common/Feedback.jsx'
import { useApi } from '../../hooks/useApi.js'
import { deleteAdminStudent, getAdminStudents } from '../../lib/api.js'
import { formatCgpa, formatNumber, plural } from '../../lib/format.js'
import AdminDialog from './AdminDialog.jsx'
import BacklogClearDialog from './BacklogClearDialog.jsx'
import StudentCreateFlow from './StudentCreateFlow.jsx'
import StudentEditDialog from './StudentEditDialog.jsx'
import {
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
  smallButton,
} from './adminStyles.js'

function sourceLabel(source) {
  if (source === 'manual') return 'Manual'
  if (source === 'simulated') return 'Simulated'
  return 'Seeded'
}

export default function AdminStudentsTab({
  adminKey,
  branch,
  semester,
  meta,
}) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [clearing, setClearing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const studentsApi = useApi(
    (signal) =>
      getAdminStudents(
        { department: branch, semester },
        adminKey,
        signal,
      ),
    [branch, semester, adminKey],
  )

  const allItems = studentsApi.data?.items || []
  const term = search.trim().toLowerCase()
  const items = term
    ? allItems.filter(
        (student) =>
          student.roll_number.toLowerCase().includes(term) ||
          student.name.toLowerCase().includes(term),
      )
    : allItems
  const withBacklogs = allItems.filter(
    (student) => (student.summary?.backlog_count || 0) > 0,
  ).length
  const averageCgpa =
    allItems.length > 0
      ? allItems.reduce(
          (sum, student) => sum + (student.summary?.cgpa || 0),
          0,
        ) / allItems.length
      : 0

  function created(result) {
    setNotice(
      `${result.student.name} (${result.student.roll_number}) was created. The record is immediately public.`,
    )
    setSearch(result.student.roll_number)
    studentsApi.reload()
  }

  function updated(result) {
    setNotice(`${result.student.roll_number} was updated.`)
    studentsApi.reload()
  }

  function backlogsCleared(result) {
    setNotice(
      `${result.cleared_count} ${plural(result.cleared_count, 'backlog')} cleared for ${result.student.roll_number}.`,
    )
    studentsApi.reload()
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletingBusy(true)
    setDeleteError('')
    try {
      await deleteAdminStudent(deleting.student_id, adminKey)
      setNotice(`${deleting.roll_number} was permanently deleted.`)
      if (search.trim() === deleting.roll_number) setSearch('')
      setDeleting(null)
      studentsApi.reload()
    } catch (requestError) {
      setDeleteError(requestError.message)
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Register maintenance</p>
          <h2 className="mt-1.5 font-serif text-[1.6rem] leading-tight tracking-[-0.02em] text-ink">
            Students in {branch}
          </h2>
          <p className="num mt-1.5 text-[11.5px] text-muted">
            {formatNumber(allItems.length)} records ·{' '}
            {formatNumber(withBacklogs)} with backlogs · average CGPA{' '}
            {formatCgpa(averageCgpa)} at Semester {semester}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={primaryButton}
        >
          New student
        </button>
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

      <div className="mt-5 w-full max-w-sm">
        <label htmlFor="admin-student-search" className="label mb-1.5 block">
          Search roll number or name
        </label>
        <input
          id="admin-student-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search records"
          className={inputClass}
        />
      </div>

      {studentsApi.loading && <LoadingBlock label="Loading branch students" />}
      {!studentsApi.loading && studentsApi.error && (
        <ErrorPanel
          error={studentsApi.error}
          onRetry={studentsApi.reload}
          title="Student records could not be loaded"
        />
      )}
      {!studentsApi.loading && !studentsApi.error && items.length === 0 && (
        <div className="mt-5 border-y border-line py-10">
          <p className="label">No records</p>
          <h3 className="mt-2 font-serif text-xl text-ink">
            {term ? 'No students match this search' : 'No students in this branch'}
          </h3>
          <p className="mt-2 text-[13px] text-muted">
            {term
              ? 'Clear the search to return to the full branch register.'
              : 'Create the first student to begin the register.'}
          </p>
        </div>
      )}
      {!studentsApi.loading && !studentsApi.error && items.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line">
                <th className="label px-3 py-3 font-semibold">Roll number</th>
                <th className="label px-3 py-3 font-semibold">Student</th>
                <th className="label px-3 py-3 font-semibold">Section</th>
                <th className="label px-3 py-3 font-semibold">Status</th>
                <th className="label px-3 py-3 text-right font-semibold">CGPA</th>
                <th className="label px-3 py-3 text-right font-semibold">Backlogs</th>
                <th className="label px-3 py-3 font-semibold">Source</th>
                <th className="label px-3 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((student) => (
                <tr
                  key={student.student_id}
                  className="border-b border-line/80 transition-colors hover:bg-surface/70"
                >
                  <td className="num whitespace-nowrap px-3 py-3.5 text-[11.5px] text-muted">
                    {student.roll_number}
                  </td>
                  <td className="px-3 py-3.5 text-[13px] font-medium text-ink">
                    {student.name}
                  </td>
                  <td className="num px-3 py-3.5 text-[12px] text-ink-soft">
                    {student.section}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    {student.status}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-[13px] font-semibold text-ink">
                    {formatCgpa(student.summary?.cgpa)}
                  </td>
                  <td
                    className={`num px-3 py-3.5 text-right text-[12.5px] ${
                      (student.summary?.backlog_count || 0) > 0
                        ? 'font-semibold text-danger'
                        : 'text-muted'
                    }`}
                  >
                    {formatNumber(student.summary?.backlog_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                      {sourceLabel(student.record_source)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <a
                        href={`/students/${student.student_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={smallButton}
                      >
                        Profile ↗
                      </a>
                      {(student.summary?.backlog_count || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setClearing(student)}
                          className={smallButton}
                        >
                          Clear backlogs
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(student)}
                        className={smallButton}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError('')
                          setDeleting(student)
                        }}
                        className={`${smallButton} !text-danger hover:!border-danger`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num mt-2.5 text-[10.5px] text-muted">
            Showing {formatNumber(items.length)} of {formatNumber(allItems.length)}{' '}
            {plural(allItems.length, 'student')}. CGPA and backlogs reflect Semester{' '}
            {semester}.
          </p>
        </div>
      )}

      {creating && (
        <StudentCreateFlow
          branch={branch}
          semester={semester}
          meta={meta}
          adminKey={adminKey}
          onClose={() => setCreating(false)}
          onCreated={created}
        />
      )}

      {editing && (
        <StudentEditDialog
          student={editing}
          adminKey={adminKey}
          onClose={() => setEditing(null)}
          onSaved={updated}
        />
      )}

      {clearing && (
        <BacklogClearDialog
          student={clearing}
          adminKey={adminKey}
          onClose={() => setClearing(null)}
          onCleared={backlogsCleared}
        />
      )}

      {deleting && (
        <AdminDialog
          eyebrow="Permanent deletion"
          title={`Delete ${deleting.roll_number}?`}
          description="This removes the student, all four summaries, every Cassandra result row, and adds an audit entry."
          size="sm"
          onClose={() => setDeleting(null)}
        >
          <div className="border-l-2 border-danger bg-danger-soft/35 px-4 py-3">
            <p className="text-[13px] font-medium text-ink">{deleting.name}</p>
            <p className="num mt-1 text-[11.5px] text-ink-soft">
              {deleting.roll_number} · Section {deleting.section} ·{' '}
              {deleting.current_semester === 4 ? 'Semester 4' : `Semester ${deleting.current_semester}`}
            </p>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            This action cannot be undone. Public profiles and register entries will
            disappear immediately.
          </p>
          {deleteError && (
            <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12.5px] text-danger">
              {deleteError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deletingBusy}
              className={dangerButton}
            >
              {deletingBusy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  )
}
