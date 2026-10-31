import { useState } from 'react'

import { updateAdminStudent } from '../../lib/api.js'
import AdminDialog from './AdminDialog.jsx'
import {
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from './adminStyles.js'

export default function StudentEditDialog({ student, adminKey, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: student.name,
    section: student.section,
    email: student.email || '',
    admission_year: student.admission_year || 2024,
    current_semester: student.current_semester || 4,
    status: student.status || 'ACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (form.name.trim().length < 2) {
      setError('Name must contain at least two characters.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await updateAdminStudent(
        student.student_id,
        {
          name: form.name.trim(),
          section: form.section,
          email: form.email.trim() || null,
          admission_year: Number(form.admission_year),
          current_semester: Number(form.current_semester),
          status: form.status,
        },
        adminKey,
      )
      onSaved(result)
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminDialog
      eyebrow="Student profile"
      title={`Edit ${student.roll_number}`}
      description="Roll number and branch stay fixed. A name change is cascaded to every stored result and summary."
      size="md"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={labelClass}>Roll number</p>
            <p className="num mt-2 text-[13.5px] font-medium text-ink">
              {student.roll_number}
            </p>
          </div>
          <div>
            <p className={labelClass}>Branch</p>
            <p className="mt-2 text-[13.5px] text-ink">
              {student.department_code} · {student.department_name}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="edit-name" className={`${labelClass} mb-1.5 block`}>
            Full name
          </label>
          <input
            id="edit-name"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-section" className={`${labelClass} mb-1.5 block`}>
              Section
            </label>
            <select
              id="edit-section"
              value={form.section}
              onChange={(event) => setField('section', event.target.value)}
              className={inputClass}
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-status" className={`${labelClass} mb-1.5 block`}>
              Status
            </label>
            <select
              id="edit-status"
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              className={inputClass}
            >
              <option value="ACTIVE">Active</option>
              <option value="GRADUATED">Graduated</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-admission" className={`${labelClass} mb-1.5 block`}>
              Admission year
            </label>
            <input
              id="edit-admission"
              type="number"
              min="2000"
              max="2100"
              value={form.admission_year}
              onChange={(event) => setField('admission_year', event.target.value)}
              className={`${inputClass} num`}
            />
          </div>
          <div>
            <label htmlFor="edit-current-semester" className={`${labelClass} mb-1.5 block`}>
              Current semester
            </label>
            <select
              id="edit-current-semester"
              value={form.current_semester}
              onChange={(event) => setField('current_semester', event.target.value)}
              className={inputClass}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  Semester {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="edit-email" className={`${labelClass} mb-1.5 block`}>
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
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
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </AdminDialog>
  )
}
