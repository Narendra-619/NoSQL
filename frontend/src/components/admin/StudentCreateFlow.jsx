import { useState } from 'react'

import { LoadingBlock } from '../common/Feedback.jsx'
import StatusBadge from '../common/StatusBadge.jsx'
import {
  createAdminStudent,
  previewAdminStudent,
} from '../../lib/api.js'
import { formatCgpa } from '../../lib/format.js'
import { evaluateResult, semesterStats } from '../../lib/grades.js'
import AdminDialog from './AdminDialog.jsx'
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButton,
  quietButton,
  secondaryButton,
} from './adminStyles.js'

const SEMESTERS = [1, 2, 3, 4]

function identityPayload(identity) {
  return {
    ...identity,
    roll_number: identity.roll_number.trim().toUpperCase(),
    name: identity.name.trim(),
    email: identity.email.trim() || null,
    admission_year: Number(identity.admission_year),
    current_semester: Number(identity.current_semester),
  }
}

function SummaryCards({ preview }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
      {preview.semesters.map((semester) => (
        <div key={semester.semester} className="bg-surface px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <p className="label text-[10px]">Semester {semester.semester}</p>
            <StatusBadge status={semester.result_status} compact />
          </div>
          <p className="num mt-2 text-[1.45rem] font-semibold leading-none text-ink">
            {formatCgpa(semester.sgpa)}
          </p>
          <p className="num mt-1.5 text-[10.5px] text-muted">
            CGPA {formatCgpa(semester.cgpa)} · {semester.backlog_count} backlog
            {semester.backlog_count === 1 ? '' : 's'}
          </p>
        </div>
      ))}
    </div>
  )
}

function SemesterDetails({ preview }) {
  return (
    <div className="mt-5 space-y-2">
      {preview.semesters.map((semester) => (
        <details key={semester.semester} className={cardClass}>
          <summary className="cursor-pointer list-none px-4 py-3 text-[12.5px] font-medium text-ink marker:content-none">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Semester {semester.semester} · {semester.academic_year}
              </span>
              <span className="num text-[11px] text-muted">
                SGPA {formatCgpa(semester.sgpa)} · {semester.credits_earned}/
                {semester.credits_registered} credits · {semester.failed_subject_count}{' '}
                failed
              </span>
            </span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-4 py-2.5 font-semibold">Subject</th>
                  <th className="label px-2 py-2.5 text-right font-semibold">Internal</th>
                  <th className="label px-2 py-2.5 text-right font-semibold">External</th>
                  <th className="label px-2 py-2.5 text-right font-semibold">Total</th>
                  <th className="label px-2 py-2.5 text-center font-semibold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {semester.subjects.map((subject) => (
                  <tr key={subject.subject_code} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="num block text-[9.5px] tracking-[0.04em] text-muted">
                        {subject.subject_code}
                      </span>
                      <span className="text-[12px] font-medium text-ink">
                        {subject.subject_name}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )
}

export default function StudentCreateFlow({
  branch,
  semester,
  meta,
  adminKey,
  onClose,
  onCreated,
}) {
  const [step, setStep] = useState('identity')
  const [mode, setMode] = useState(null)
  const [identity, setIdentity] = useState({
    roll_number: '',
    name: '',
    department_code: branch,
    section: 'A',
    admission_year: 2024,
    current_semester: semester,
    email: '',
    status: 'ACTIVE',
  })
  const [identityErrors, setIdentityErrors] = useState({})
  const [manualSemester, setManualSemester] = useState(1)
  const [marks, setMarks] = useState({})
  const [preview, setPreview] = useState(null)
  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subjectsFor = (semesterNumber) =>
    meta.subjects.filter((subject) => subject.semester === semesterNumber)
  const currentSubjects = subjectsFor(manualSemester)
  const currentStats = semesterStats(currentSubjects, marks, meta.grade_bands)

  function setIdentityField(key, value) {
    setIdentity((current) => ({ ...current, [key]: value }))
    setIdentityErrors((current) => ({ ...current, [key]: undefined }))
    setError('')
  }

  function validateIdentity() {
    const nextErrors = {}
    const roll = identity.roll_number.trim().toUpperCase()
    const pattern = new RegExp(`^[0-9]{2}${branch}[0-9]{3}$`)
    if (!pattern.test(roll)) {
      nextErrors.roll_number = `Use a roll number such as 24${branch}101.`
    }
    if (identity.name.trim().length < 2) {
      nextErrors.name = 'Enter the student name.'
    }
    if (
      !Number.isInteger(Number(identity.admission_year)) ||
      Number(identity.admission_year) < 2000 ||
      Number(identity.admission_year) > 2100
    ) {
      nextErrors.admission_year = 'Enter a valid admission year.'
    }
    setIdentityErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function loadSimulatedPreview() {
    setLoading(true)
    setError('')
    try {
      const data = await previewAdminStudent(
        { identity: identityPayload(identity), mode: 'simulated' },
        adminKey,
      )
      setPreview(data)
      setMode('simulated')
      setStep('auto')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function beginSimulation() {
    if (!validateIdentity()) return
    loadSimulatedPreview()
  }

  function beginManual() {
    if (!validateIdentity()) return
    setMode('manual')
    setStep('manual')
    setManualSemester(1)
  }

  function marksFor(semesterNumber, subjectCode) {
    return (
      marks[`${semesterNumber}:${subjectCode}`] || { internal: '', external: '' }
    )
  }

  function setMark(semesterNumber, subjectCode, field, value) {
    setMarks((current) => ({
      ...current,
      [`${semesterNumber}:${subjectCode}`]: {
        ...(current[`${semesterNumber}:${subjectCode}`] || {
          internal: '',
          external: '',
        }),
        [field]: value,
      },
    }))
    setError('')
  }

  function semesterIsValid(semesterNumber) {
    return subjectsFor(semesterNumber).every((subject) => {
      const values = marksFor(semesterNumber, subject.code)
      return evaluateResult(
        values.internal,
        values.external,
        subject,
        meta.grade_bands,
      ).valid
    })
  }

  function manualPayload() {
    return SEMESTERS.map((semesterNumber) => ({
      semester: semesterNumber,
      results: subjectsFor(semesterNumber).map((subject) => {
        const values = marksFor(semesterNumber, subject.code)
        return {
          subject_code: subject.code,
          internal_marks: Number(values.internal),
          external_marks: Number(values.external),
        }
      }),
    }))
  }

  async function openManualReview() {
    for (const semesterNumber of SEMESTERS) {
      if (!semesterIsValid(semesterNumber)) {
        setManualSemester(semesterNumber)
        setError(`Complete all five valid mark entries for Semester ${semesterNumber}.`)
        return
      }
    }
    setLoading(true)
    setError('')
    try {
      const data = await previewAdminStudent(
        {
          identity: identityPayload(identity),
          mode: 'manual',
          semesters: manualPayload(),
        },
        adminKey,
      )
      setPreview(data)
      setStep('review')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function nextSemester() {
    if (!semesterIsValid(manualSemester)) {
      setError(`Complete all five valid mark entries for Semester ${manualSemester}.`)
      return
    }
    setError('')
    if (manualSemester < 4) setManualSemester((current) => current + 1)
    else openManualReview()
  }

  function backFromManual() {
    setError('')
    if (manualSemester > 1) setManualSemester((current) => current - 1)
    else setStep('identity')
  }

  async function confirmCreate() {
    if (preview?.roll_number_available === false) {
      setError('That roll number already exists. Choose another roll number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload =
        mode === 'simulated'
          ? {
              identity: identityPayload(identity),
              mode: 'simulated',
              generation_seed: preview.generation_seed,
            }
          : {
              identity: identityPayload(identity),
              mode: 'manual',
              semesters: manualPayload(),
            }
      const result = await createAdminStudent(payload, adminKey)
      setCreated(result)
      setStep('success')
      onCreated(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const title =
    step === 'success'
      ? 'Student record created'
      : step === 'review'
        ? 'Review full record'
        : step === 'auto'
          ? 'Simulated record preview'
          : step === 'manual'
            ? `Marks · Semester ${manualSemester}`
            : 'Create student record'

  return (
    <AdminDialog
      eyebrow={`${branch} · ${meta.department.name}`}
      title={title}
      description={
        step === 'success'
          ? 'The student is now visible in the public register and every summary has been written.'
          : 'Every creation mode writes all four semesters and five subjects per semester.'
      }
      size="xl"
      onClose={onClose}
    >
      {step === 'identity' && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="create-roll" className={`${labelClass} mb-1.5 block`}>
                Roll number
              </label>
              <input
                id="create-roll"
                value={identity.roll_number}
                onChange={(event) =>
                  setIdentityField('roll_number', event.target.value.toUpperCase())
                }
                placeholder={`24${branch}101`}
                className={`${inputClass} num`}
              />
              {identityErrors.roll_number && (
                <p className="mt-1.5 text-[11px] text-danger">
                  {identityErrors.roll_number}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="create-name" className={`${labelClass} mb-1.5 block`}>
                Full name
              </label>
              <input
                id="create-name"
                value={identity.name}
                onChange={(event) => setIdentityField('name', event.target.value)}
                placeholder="Student name"
                className={inputClass}
              />
              {identityErrors.name && (
                <p className="mt-1.5 text-[11px] text-danger">{identityErrors.name}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className={labelClass}>Branch</p>
              <p className="mt-2 text-[13px] text-ink">{branch}</p>
            </div>
            <div>
              <label htmlFor="create-section" className={`${labelClass} mb-1.5 block`}>
                Section
              </label>
              <select
                id="create-section"
                value={identity.section}
                onChange={(event) => setIdentityField('section', event.target.value)}
                className={inputClass}
              >
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-admission" className={`${labelClass} mb-1.5 block`}>
                Admission year
              </label>
              <input
                id="create-admission"
                type="number"
                min="2000"
                max="2100"
                value={identity.admission_year}
                onChange={(event) =>
                  setIdentityField('admission_year', event.target.value)
                }
                className={`${inputClass} num`}
              />
              {identityErrors.admission_year && (
                <p className="mt-1.5 text-[11px] text-danger">
                  {identityErrors.admission_year}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="create-current-semester"
                className={`${labelClass} mb-1.5 block`}
              >
                Current semester
              </label>
              <select
                id="create-current-semester"
                value={identity.current_semester}
                onChange={(event) =>
                  setIdentityField('current_semester', event.target.value)
                }
                className={inputClass}
              >
                {SEMESTERS.map((value) => (
                  <option key={value} value={value}>
                    Semester {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="create-email" className={`${labelClass} mb-1.5 block`}>
                Email
              </label>
              <input
                id="create-email"
                type="email"
                value={identity.email}
                onChange={(event) => setIdentityField('email', event.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="create-status" className={`${labelClass} mb-1.5 block`}>
                Status
              </label>
              <select
                id="create-status"
                value={identity.status}
                onChange={(event) => setIdentityField('status', event.target.value)}
                className={inputClass}
              >
                <option value="ACTIVE">Active</option>
                <option value="GRADUATED">Graduated</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12.5px] text-danger">
              {error}
            </p>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <p className="label">Choose how to build the record</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={beginSimulation}
                disabled={loading}
                className="group border border-line bg-surface p-5 text-left transition-colors hover:border-forest hover:bg-forest-soft/35 disabled:opacity-55"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink">
                    Simulate full record
                  </span>
                  <span aria-hidden="true" className="text-forest">→</span>
                </span>
                <span className="mt-2 block text-[12px] leading-relaxed text-muted">
                  Generate realistic marks for all 20 subjects. Review and
                  regenerate the preview before writing anything.
                </span>
              </button>
              <button
                type="button"
                onClick={beginManual}
                disabled={loading}
                className="group border border-line bg-surface p-5 text-left transition-colors hover:border-forest hover:bg-forest-soft/35 disabled:opacity-55"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink">
                    Enter marks manually
                  </span>
                  <span aria-hidden="true" className="text-forest">→</span>
                </span>
                <span className="mt-2 block text-[12px] leading-relaxed text-muted">
                  Work through Semesters 1–4 and enter internal and external
                  marks for every fixed subject.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'auto' && (
        <div>
          {loading && <LoadingBlock label="Generating simulated record" />}
          {error && (
            <p role="alert" className="border-l-2 border-danger pl-3 text-[12.5px] text-danger">
              {error}
            </p>
          )}
          {preview && !loading && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="label">Simulation seed</p>
                  <p className="num mt-1 break-all text-[11.5px] text-muted">
                    {preview.generation_seed}
                  </p>
                </div>
                <p className="num text-[12px] text-ink-soft">
                  {preview.overall_result_status} ·{' '}
                  {preview.overall_backlog_count} overall backlog
                  {preview.overall_backlog_count === 1 ? '' : 's'}
                </p>
              </div>
              {!preview.roll_number_available && (
                <p className="mt-3 border-l-2 border-danger pl-3 text-[12.5px] text-danger">
                  This roll number already exists. Return to identity and choose another.
                </p>
              )}
              <div className="mt-4">
                <SummaryCards preview={preview} />
              </div>
              <SemesterDetails preview={preview} />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <button type="button" onClick={() => setStep('identity')} className={quietButton}>
                  ← Back to identity
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadSimulatedPreview}
                    disabled={loading}
                    className={secondaryButton}
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={confirmCreate}
                    disabled={loading || !preview.roll_number_available}
                    className={primaryButton}
                  >
                    Confirm & create
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'manual' && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              {SEMESTERS.map((value) => (
                <span
                  key={value}
                  className={`num grid h-8 min-w-8 place-items-center rounded-full border px-2 text-[11px] font-semibold ${
                    value === manualSemester
                      ? 'border-forest bg-forest text-paper'
                      : value < manualSemester
                        ? 'border-forest/30 bg-forest-soft text-forest'
                        : 'border-line bg-surface text-muted'
                  }`}
                >
                  {value}
                </span>
              ))}
            </div>
            <p className="num text-[11.5px] text-muted">
              {currentStats
                ? `SGPA ${formatCgpa(currentStats.sgpa)} · ${currentStats.failedCount} failed`
                : 'Complete all five subjects to preview SGPA'}
            </p>
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            Internal 0–30 · External 0–70 · Total 0–100 · Pass mark 40. Credits
            are fixed by the subject catalogue.
          </p>

          <div className="mt-4 overflow-x-auto border-y border-line">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface/60">
                  <th className="label px-3 py-2.5 font-semibold">Subject</th>
                  <th className="label px-2 py-2.5 text-right font-semibold">Credits</th>
                  <th className="label px-2 py-2.5 text-center font-semibold">Internal / 30</th>
                  <th className="label px-2 py-2.5 text-center font-semibold">External / 70</th>
                  <th className="label px-2 py-2.5 text-right font-semibold">Total</th>
                  <th className="label px-2 py-2.5 text-center font-semibold">Grade</th>
                  <th className="label px-3 py-2.5 text-center font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {currentSubjects.map((subject) => {
                  const values = marksFor(manualSemester, subject.code)
                  const outcome = evaluateResult(
                    values.internal,
                    values.external,
                    subject,
                    meta.grade_bands,
                  )
                  return (
                    <tr key={subject.code} className="border-b border-line/70 last:border-0">
                      <td className="px-3 py-3">
                        <span className="num block text-[9.5px] tracking-[0.04em] text-muted">
                          {subject.code}
                        </span>
                        <span className="text-[12.5px] font-medium text-ink">
                          {subject.name}
                        </span>
                      </td>
                      <td className="num px-2 py-3 text-right text-[12px] text-muted">
                        {subject.credits}
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          max={subject.internal_max}
                          step="1"
                          value={values.internal}
                          onChange={(event) =>
                            setMark(
                              manualSemester,
                              subject.code,
                              'internal',
                              event.target.value,
                            )
                          }
                          aria-label={`${subject.code} internal marks`}
                          className={`${inputClass} num min-w-[5.5rem] text-right`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          max={subject.external_max}
                          step="1"
                          value={values.external}
                          onChange={(event) =>
                            setMark(
                              manualSemester,
                              subject.code,
                              'external',
                              event.target.value,
                            )
                          }
                          aria-label={`${subject.code} external marks`}
                          className={`${inputClass} num min-w-[5.5rem] text-right`}
                        />
                      </td>
                      <td className="num px-2 py-3 text-right text-[12.5px] font-semibold text-ink">
                        {outcome.valid ? outcome.total : '—'}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span
                          className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[10.5px] font-semibold ${
                            outcome.valid
                              ? outcome.status === 'FAIL'
                                ? 'bg-danger-soft text-danger'
                                : 'bg-forest-soft text-forest'
                              : 'bg-surface-2 text-muted'
                          }`}
                        >
                          {outcome.valid ? outcome.grade : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {outcome.valid ? (
                          <StatusBadge status={outcome.status} compact />
                        ) : (
                          <span className="text-[10.5px] text-muted">Incomplete</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {meta.grade_bands.map((band) => (
                <span key={band.grade} className="num text-[10.5px] text-muted">
                  {band.min_marks}+ {band.grade} · {band.points}
                </span>
              ))}
            </div>
            <p className="num text-[10.5px] text-muted">
              {currentStats
                ? `${currentStats.earned} of ${currentStats.credits} credits`
                : 'Credits update when all marks are valid'}
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12.5px] text-danger">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button type="button" onClick={backFromManual} className={quietButton}>
              ← {manualSemester === 1 ? 'Back to identity' : 'Previous semester'}
            </button>
            <button
              type="button"
              onClick={nextSemester}
              disabled={loading}
              className={primaryButton}
            >
              {loading
                ? 'Preparing review…'
                : manualSemester === 4
                  ? 'Review full record'
                  : `Continue to Semester ${manualSemester + 1}`}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          {loading && <LoadingBlock label="Validating full record" />}
          {preview && !loading && (
            <>
              <div className="grid gap-4 border-b border-line pb-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Roll number', preview.identity.roll_number],
                  ['Name', preview.identity.name],
                  ['Branch', preview.identity.department_name],
                  ['Mode', preview.mode === 'simulated' ? 'Simulated' : 'Manual'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="label">{label}</p>
                    <p className="mt-1.5 text-[13px] font-medium text-ink">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="num text-[12px] text-ink-soft">
                  Overall {preview.overall_result_status} ·{' '}
                  {preview.overall_backlog_count} backlog
                  {preview.overall_backlog_count === 1 ? '' : 's'}
                </p>
                {!preview.roll_number_available && (
                  <p className="text-[12px] font-medium text-danger">
                    Roll number already exists
                  </p>
                )}
              </div>

              <div className="mt-4">
                <SummaryCards preview={preview} />
              </div>
              <SemesterDetails preview={preview} />

              {error && (
                <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12.5px] text-danger">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <button
                  type="button"
                  onClick={() =>
                    mode === 'simulated' ? setStep('auto') : setStep('manual')
                  }
                  className={quietButton}
                >
                  ← Edit record
                </button>
                <button
                  type="button"
                  onClick={confirmCreate}
                  disabled={loading || !preview.roll_number_available}
                  className={primaryButton}
                >
                  {loading ? 'Creating record…' : 'Confirm & create student'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'success' && created && (
        <div>
          <div className="border-l-2 border-success bg-forest-soft/50 px-4 py-3">
            <p className="text-[13px] font-medium text-forest">
              {created.student.name} was created with a complete four-semester record.
            </p>
            <p className="num mt-1 text-[11.5px] text-ink-soft">
              {created.student.roll_number} · {created.student.department_code} ·{' '}
              {created.overall_backlog_count} backlogs · {created.record_source}
            </p>
          </div>

          <SummaryCards preview={created} />
          <SemesterDetails preview={created} />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <a
              href={`/students/${created.student.student_id}`}
              target="_blank"
              rel="noreferrer"
              className={quietButton}
            >
              Open public profile ↗
            </a>
            <button type="button" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </div>
        </div>
      )}
    </AdminDialog>
  )
}
