import { useEffect, useMemo, useRef, useState } from 'react'

import { ErrorPanel, LoadingBlock } from '../common/Feedback.jsx'
import { useApi } from '../../hooks/useApi.js'
import {
  clearAdminBacklogs,
  getAdminBacklogs,
  previewAdminBacklogClear,
} from '../../lib/api.js'
import { formatCgpa, formatNumber, plural } from '../../lib/format.js'
import AdminDialog from './AdminDialog.jsx'
import {
  primaryButton,
  secondaryButton,
  smallButton,
} from './adminStyles.js'

function keyFor(item) {
  return `${item.semester}:${item.subject_code}`
}

function markInputClass() {
  return 'num h-9 w-20 rounded-[4px] border border-line bg-surface px-2 text-[12px] text-ink transition-colors hover:border-line-strong focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25'
}

function buildPayload(selectedItems, mode, manual) {
  if (selectedItems.length === 0) {
    return {
      payload: null,
      error: 'Select at least one failed subject.',
    }
  }

  const payloadItems = []
  for (const item of selectedItems) {
    if (mode === 'generated') {
      payloadItems.push({
        semester: item.semester,
        subject_code: item.subject_code,
      })
      continue
    }

    const key = keyFor(item)
    const marks = manual[key] || {}
    if (
      marks.internal === '' ||
      marks.internal === undefined ||
      marks.external === '' ||
      marks.external === undefined
    ) {
      return {
        payload: null,
        error: `Enter both marks for ${item.subject_code}.`,
      }
    }
    const internal = Number(marks.internal)
    const external = Number(marks.external)
    if (
      !Number.isInteger(internal) ||
      !Number.isInteger(external) ||
      internal < 0 ||
      internal > 30 ||
      external < 0 ||
      external > 70
    ) {
      return {
        payload: null,
        error: `Marks for ${item.subject_code} must be whole numbers within Internal 0–30 and External 0–70.`,
      }
    }
    if (internal + external < 40) {
      return {
        payload: null,
        error: `${item.subject_code} totals ${internal + external}; a passing total of at least 40 is required.`,
      }
    }
    payloadItems.push({
      semester: item.semester,
      subject_code: item.subject_code,
      internal_marks: internal,
      external_marks: external,
    })
  }
  return { payload: { items: payloadItems }, error: '' }
}

function manualMarksComplete(selectedItems, manual) {
  return selectedItems.every((item) => {
    const marks = manual[keyFor(item)] || {}
    return (
      marks.internal !== '' &&
      marks.internal !== undefined &&
      marks.external !== '' &&
      marks.external !== undefined
    )
  })
}

export default function BacklogClearDialog({
  student,
  adminKey,
  onClose,
  onCleared,
}) {
  const backlogApi = useApi(
    (signal) => getAdminBacklogs(student.student_id, adminKey, signal),
    [student.student_id, adminKey],
  )
  const [selection, setSelection] = useState(null)
  const [mode, setMode] = useState('generated')
  const [manual, setManual] = useState({})
  const [preview, setPreview] = useState(null)
  const [applied, setApplied] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const previewRequest = useRef(0)

  const items = useMemo(
    () => backlogApi.data?.items || [],
    [backlogApi.data],
  )
  const allKeys = useMemo(() => items.map(keyFor), [items])
  const selectedKeys = selection ?? allKeys
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const itemByKey = useMemo(
    () => Object.fromEntries(items.map((item) => [keyFor(item), item])),
    [items],
  )
  const selectedItems = useMemo(
    () => selectedKeys.map((key) => itemByKey[key]).filter(Boolean),
    [selectedKeys, itemByKey],
  )
  const previewByKey = useMemo(
    () =>
      Object.fromEntries(
        (preview?.items || []).map((item) => [keyFor(item), item]),
      ),
    [preview],
  )

  useEffect(() => {
    if (applied) return undefined
    const { payload, error: validationError } = buildPayload(
      selectedItems,
      mode,
      manual,
    )
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (!payload) {
        setPreview(null)
        setPreviewBusy(false)
        const showValidation =
          mode === 'manual' &&
          selectedItems.length > 0 &&
          manualMarksComplete(selectedItems, manual)
        setError(showValidation ? validationError : '')
        return
      }

      const requestId = previewRequest.current + 1
      previewRequest.current = requestId
      setError('')
      setPreviewBusy(true)
      try {
        const result = await previewAdminBacklogClear(
          student.student_id,
          payload,
          adminKey,
          controller.signal,
        )
        if (previewRequest.current === requestId && !controller.signal.aborted) {
          setPreview(result)
        }
      } catch (requestError) {
        if (
          !controller.signal.aborted &&
          requestError.name !== 'AbortError' &&
          previewRequest.current === requestId
        ) {
          setError(requestError.message)
        }
      } finally {
        if (previewRequest.current === requestId) {
          setPreviewBusy(false)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
      previewRequest.current += 1
      setPreviewBusy(false)
    }
  }, [selectedItems, mode, manual, applied, adminKey, student.student_id])

  function updateSelection(next) {
    setSelection(next)
    setPreview(null)
    setError('')
  }

  function toggle(key) {
    if (selectedSet.has(key)) {
      updateSelection(selectedKeys.filter((value) => value !== key))
    } else {
      updateSelection([...selectedKeys, key])
    }
  }

  function changeMode(next) {
    setMode(next)
    setPreview(null)
    setError('')
  }

  function setMark(key, field, value) {
    setManual((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }))
    setPreview(null)
    setError('')
  }

  async function runPreview() {
    const { payload, error: validationError } = buildPayload(
      selectedItems,
      mode,
      manual,
    )
    if (!payload) {
      setError(validationError)
      return
    }

    const requestId = previewRequest.current + 1
    previewRequest.current = requestId
    setError('')
    setPreviewBusy(true)
    try {
      const result = await previewAdminBacklogClear(
        student.student_id,
        payload,
        adminKey,
      )
      if (previewRequest.current === requestId) {
        setPreview(result)
      }
    } catch (requestError) {
      if (previewRequest.current === requestId) {
        setError(requestError.message)
      }
    } finally {
      if (previewRequest.current === requestId) {
        setPreviewBusy(false)
      }
    }
  }

  async function runClear() {
    const { payload, error: validationError } = buildPayload(
      selectedItems,
      mode,
      manual,
    )
    if (!payload) {
      setError(validationError)
      return
    }
    if (!preview) {
      setError('Preview the selected marks before clearing.')
      return
    }

    setClearing(true)
    setError('')
    try {
      const result = await clearAdminBacklogs(
        student.student_id,
        payload,
        adminKey,
      )
      setPreview(result)
      setApplied(result)
      onCleared(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setClearing(false)
    }
  }

  const summary = backlogApi.data?.summary

  return (
    <AdminDialog
      eyebrow="Backlog clearance"
      title={`Clear backlogs · ${student.roll_number}`}
      description={`${student.name} · ${student.department_code} · Semester ${student.current_semester}. Selected failed subjects are replaced with passing marks and every stored summary is recomputed.`}
      size="xl"
      onClose={onClose}
    >
      {backlogApi.loading && <LoadingBlock label="Loading failed subjects" />}
      {!backlogApi.loading && backlogApi.error && (
        <ErrorPanel
          error={backlogApi.error}
          onRetry={backlogApi.reload}
          title="Backlogs could not be loaded"
        />
      )}

      {!backlogApi.loading && !backlogApi.error && applied && (
        <div>
          <div className="border-l-2 border-success bg-forest-soft/50 px-4 py-3">
            <p className="text-[13px] font-medium text-forest">
              {formatNumber(applied.cleared_count)}{' '}
              {plural(applied.cleared_count, 'backlog')} cleared and summaries
              recomputed.
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Overall backlogs moved from{' '}
              {formatNumber(applied.before?.backlog_count)} to{' '}
              {formatNumber(applied.after?.backlog_count)}.
            </p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {[
              ['CGPA before', formatCgpa(applied.before?.cgpa)],
              ['CGPA after', formatCgpa(applied.after?.cgpa)],
              ['Backlogs before', formatNumber(applied.before?.backlog_count)],
              ['Backlogs after', formatNumber(applied.after?.backlog_count)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-4 py-4">
                <dt className="label text-[10px]">{label}</dt>
                <dd className="num mt-1.5 text-[1.25rem] font-semibold text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 divide-y divide-line/70 border-y border-line">
            {applied.items.map((item) => (
              <div
                key={keyFor(item)}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2.5"
              >
                <p className="text-[12.5px] text-ink">
                  <span className="num text-muted">Sem {item.semester}</span>{' '}
                  {item.subject_code} · {item.subject_name}
                </p>
                <p className="num text-[12px] text-ink-soft">
                  {item.previous.total_marks} → {item.total_marks} · Grade{' '}
                  {item.grade} · {item.result_status}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <button type="button" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </div>
        </div>
      )}

      {!backlogApi.loading &&
        !backlogApi.error &&
        !applied &&
        items.length === 0 && (
          <div className="border-y border-line py-10">
            <p className="label">No backlogs</p>
            <h3 className="mt-2 font-serif text-xl text-ink">
              No failed subjects remain for {student.roll_number}
            </h3>
            <p className="mt-2 text-[13px] text-muted">
              The register may already have been updated. Close this dialog to
              refresh the student list.
            </p>
            <div className="mt-5">
              <button type="button" onClick={onClose} className={secondaryButton}>
                Close
              </button>
            </div>
          </div>
        )}

      {!backlogApi.loading && !backlogApi.error && !applied && items.length > 0 && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="label">Current position</p>
              <p className="num mt-1.5 text-[12.5px] text-ink-soft">
                CGPA {formatCgpa(summary?.cgpa)} ·{' '}
                {formatNumber(summary?.backlog_count)}{' '}
                {plural(summary?.backlog_count || 0, 'backlog')} · Semester{' '}
                {summary?.semester}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateSelection(allKeys)}
                className={smallButton}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => updateSelection([])}
                className={smallButton}
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="label">Marks for selected</p>
            <div className="inline-flex rounded-[4px] border border-line bg-surface p-0.5">
              {[
                ['generated', 'Generate passing marks'],
                ['manual', 'Enter marks manually'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMode(value)}
                  className={`rounded-[3px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    mode === value
                      ? 'bg-forest text-paper'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="num text-[11.5px] text-muted">
              {formatNumber(selectedItems.length)} of{' '}
              {formatNumber(items.length)} selected
            </p>
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            {previewBusy
              ? 'Refreshing preview…'
              : 'Preview updates automatically once every selected subject has valid marks.'}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-y border-line">
                  <th className="label px-2 py-3 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="label px-2 py-3 font-semibold">Semester</th>
                  <th className="label px-2 py-3 font-semibold">Subject</th>
                  <th className="label px-2 py-3 text-right font-semibold">
                    Current
                  </th>
                  <th className="label px-2 py-3 text-right font-semibold">
                    Proposed
                  </th>
                  {mode === 'manual' && (
                    <th className="label px-2 py-3 font-semibold">New marks</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const key = keyFor(item)
                  const isSelected = selectedSet.has(key)
                  const proposed = previewByKey[key]
                  const marks = manual[key] || {}
                  return (
                    <tr
                      key={key}
                      className={`border-b border-line/80 transition-colors ${
                        isSelected ? 'bg-forest-soft/20' : 'hover:bg-surface/70'
                      }`}
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(key)}
                          aria-label={`Select ${item.subject_code}`}
                        />
                      </td>
                      <td className="num px-2 py-3 text-[11.5px] text-muted">
                        {item.semester}
                      </td>
                      <td className="px-2 py-3">
                        <p className="num text-[11.5px] text-muted">
                          {item.subject_code}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink">
                          {item.subject_name}
                        </p>
                      </td>
                      <td className="num px-2 py-3 text-right text-[12px] text-ink-soft">
                        {item.internal_marks} + {item.external_marks} ={' '}
                        <span className="font-semibold text-danger">
                          {item.total_marks}
                        </span>
                      </td>
                      <td className="num px-2 py-3 text-right text-[12px] text-ink-soft">
                        {proposed ? (
                          <>
                            {proposed.internal_marks} + {proposed.external_marks} ={' '}
                            <span className="font-semibold text-forest">
                              {proposed.total_marks}
                            </span>{' '}
                            · {proposed.grade}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      {mode === 'manual' && (
                        <td className="px-2 py-3">
                          {isSelected ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="1"
                                value={marks.internal ?? ''}
                                onChange={(event) =>
                                  setMark(key, 'internal', event.target.value)
                                }
                                aria-label={`${item.subject_code} internal marks`}
                                className={markInputClass()}
                              />
                              <span className="text-muted">+</span>
                              <input
                                type="number"
                                min="0"
                                max="70"
                                step="1"
                                value={marks.external ?? ''}
                                onChange={(event) =>
                                  setMark(key, 'external', event.target.value)
                                }
                                aria-label={`${item.subject_code} external marks`}
                                className={markInputClass()}
                              />
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {preview && (
            <div className="mt-5 border border-line bg-surface/65 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="label">Projected outcome</p>
                  <p className="mt-1.5 text-[12.5px] text-ink-soft">
                    {formatNumber(preview.cleared_count)}{' '}
                    {plural(preview.cleared_count, 'subject')} will be replaced
                    with passing results.
                  </p>
                </div>
                <p className="num text-[12px] text-ink">
                  CGPA {formatCgpa(preview.before?.cgpa)} →{' '}
                  <span className="font-semibold text-forest">
                    {formatCgpa(preview.after?.cgpa)}
                  </span>
                </p>
                <p className="num text-[12px] text-ink">
                  Backlogs {formatNumber(preview.before?.backlog_count)} →{' '}
                  <span className="font-semibold text-forest">
                    {formatNumber(preview.after?.backlog_count)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 border-l-2 border-danger pl-3 text-[12.5px] text-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy || clearing || selectedItems.length === 0}
              className={secondaryButton}
            >
              {previewBusy ? 'Previewing…' : 'Retry preview'}
            </button>
            <button
              type="button"
              onClick={runClear}
              disabled={
                clearing ||
                previewBusy ||
                !preview ||
                selectedItems.length === 0
              }
              className={primaryButton}
            >
              {clearing
                ? 'Clearing…'
                : `Clear ${formatNumber(selectedItems.length)} ${plural(selectedItems.length, 'backlog')}`}
            </button>
          </div>
        </div>
      )}
    </AdminDialog>
  )
}
