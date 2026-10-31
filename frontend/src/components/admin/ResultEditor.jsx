import { useState } from 'react'

import { evaluateResult } from '../../lib/grades.js'
import { formatCgpa, formatNumber } from '../../lib/format.js'
import { updateAdminResult } from '../../lib/api.js'
import AdminDialog from './AdminDialog.jsx'
import {
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from './adminStyles.js'

export default function ResultEditor({ item, meta, adminKey, onClose, onSaved }) {
  const subject = meta.subjects.find(
    (entry) =>
      entry.semester === item.semester && entry.code === item.subject_code,
  ) || {
    code: item.subject_code,
    name: item.subject_name,
    credits: item.credits,
    internal_max: item.internal_max ?? 30,
    external_max: item.external_max ?? 70,
    pass_marks: item.pass_marks ?? 40,
  }
  const [internal, setInternal] = useState(String(item.internal_marks ?? ''))
  const [external, setExternal] = useState(String(item.external_marks ?? ''))
  const [expectedStatus, setExpectedStatus] = useState(item.result_status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  const outcome = evaluateResult(internal, external, subject, meta.grade_bands)

  async function onSave(event) {
    event.preventDefault()
    setError('')
    if (!outcome.valid) {
      setError(
        `Enter whole marks within Internal 0–${subject.internal_max} and External 0–${subject.external_max}.`,
      )
      return
    }
    if (outcome.status !== expectedStatus) {
      setError(
        `The ${outcome.total}-mark total produces ${outcome.status === 'PASS' ? 'a pass' : 'a fail'}, not the selected ${expectedStatus}.`,
      )
      return
    }
    setSaving(true)
    try {
      const result = await updateAdminResult(
        item.student_id,
        item.semester,
        item.subject_code,
        {
          internal_marks: outcome.internal,
          external_marks: outcome.external,
          expected_status: expectedStatus,
        },
        adminKey,
      )
      setSaved(result)
      onSaved(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminDialog
      eyebrow={`Semester ${item.semester} · Result correction`}
      title={item.subject_name}
      description={`${item.student_name} · ${item.roll_number} · ${item.subject_code}`}
      size="md"
      onClose={onClose}
    >
      {saved ? (
        <div>
          <div className="border-l-2 border-success bg-forest-soft/50 px-4 py-3">
            <p className="text-[13px] font-medium text-forest">
              Result corrected and summaries recomputed.
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              {saved.result.subject_code}: {saved.result.internal_marks} internal +{' '}
              {saved.result.external_marks} external = {saved.result.total_marks}{' '}
              marks · Grade {saved.result.grade} · {saved.result.result_status}
            </p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {[
              ['SGPA before', formatCgpa(saved.before.sgpa)],
              ['SGPA after', formatCgpa(saved.after.sgpa)],
              ['CGPA before', formatCgpa(saved.before.cgpa)],
              ['CGPA after', formatCgpa(saved.after.cgpa)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-4 py-4">
                <dt className="label text-[10px]">{label}</dt>
                <dd className="num mt-1.5 text-[1.25rem] font-semibold text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-[12px] text-muted">
            Backlogs changed from {formatNumber(saved.before.backlog_count)} to{' '}
            {formatNumber(saved.after.backlog_count)}. The audit trail records both
            snapshots.
          </p>

          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <button type="button" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSave} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="result-internal" className={`${labelClass} mb-1.5 block`}>
                Internal marks
                <span className="ml-2 normal-case tracking-normal text-muted">
                  0–{subject.internal_max}
                </span>
              </label>
              <input
                id="result-internal"
                type="number"
                min="0"
                max={subject.internal_max}
                step="1"
                value={internal}
                onChange={(event) => setInternal(event.target.value)}
                className={`${inputClass} num`}
              />
            </div>
            <div>
              <label htmlFor="result-external" className={`${labelClass} mb-1.5 block`}>
                External marks
                <span className="ml-2 normal-case tracking-normal text-muted">
                  0–{subject.external_max}
                </span>
              </label>
              <input
                id="result-external"
                type="number"
                min="0"
                max={subject.external_max}
                step="1"
                value={external}
                onChange={(event) => setExternal(event.target.value)}
                className={`${inputClass} num`}
              />
            </div>
          </div>

          <div className="border-y border-line py-4">
            <p className="label">Computed outcome</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <p className="num text-[2rem] font-semibold leading-none text-ink">
                {outcome.valid ? outcome.total : '—'}
                <span className="ml-1 text-[11px] font-normal uppercase tracking-[0.08em] text-muted">
                  / 100
                </span>
              </p>
              <p className="num text-[13px] text-ink-soft">
                Grade {outcome.valid ? outcome.grade : '—'} ·{' '}
                {outcome.valid ? outcome.status : 'Incomplete'}
              </p>
              <p className="num text-[11.5px] text-muted">
                Pass mark {subject.pass_marks}
              </p>
            </div>
          </div>

          <div>
            <p className={`${labelClass} mb-2`}>Expected result status</p>
            <div className="inline-flex rounded-[4px] border border-line bg-surface p-0.5">
              {[
                ['FAIL', 'Failed'],
                ['PASS', 'Passed'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExpectedStatus(value)}
                  className={`rounded-[3px] px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
                    expectedStatus === value
                      ? value === 'PASS'
                        ? 'bg-forest text-paper'
                        : 'bg-danger text-white'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-line bg-surface/65 px-4 py-3">
            <p className="label">Grade scale</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {meta.grade_bands.map((band) => (
                <span key={band.grade} className="num text-[11px] text-muted">
                  {band.min_marks}+ {band.grade} · {band.points}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-danger pl-3 text-[12.5px] text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? 'Applying correction…' : 'Save corrected result'}
            </button>
          </div>
        </form>
      )}
    </AdminDialog>
  )
}
