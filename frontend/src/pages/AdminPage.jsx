import { useState } from 'react'

import { ErrorPanel, LoadingBlock } from '../components/common/Feedback.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import SemesterSwitch from '../components/students/SemesterSwitch.jsx'
import AdminActivityTab from '../components/admin/AdminActivityTab.jsx'
import AdminGate from '../components/admin/AdminGate.jsx'
import AdminResultsTab from '../components/admin/AdminResultsTab.jsx'
import AdminStudentsTab from '../components/admin/AdminStudentsTab.jsx'
import { secondaryButton } from '../components/admin/adminStyles.js'
import { useApi } from '../hooks/useApi.js'
import { getAdminMeta, getDepartments } from '../lib/api.js'
import { semesterLabel } from '../lib/format.js'

const STORAGE_KEY = 'academic-system-admin-key'

const tabs = [
  { key: 'students', label: 'Students' },
  { key: 'results', label: 'Result corrections' },
  { key: 'activity', label: 'Activity' },
]

function storedKey() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(storedKey)
  const [branch, setBranch] = useState('CSE')
  const [semester, setSemester] = useState(4)
  const [tab, setTab] = useState('students')

  const departmentsApi = useApi(
    (signal) => getDepartments(semester, signal),
    [semester],
  )
  const metaApi = useApi(
    (signal) =>
      adminKey ? getAdminMeta(branch, adminKey, signal) : Promise.resolve(null),
    [branch, adminKey],
  )

  function authenticate(key) {
    try {
      sessionStorage.setItem(STORAGE_KEY, key)
    } catch {
      // Session storage may be unavailable in hardened browsers.
    }
    setAdminKey(key)
  }

  function lock() {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear when storage is unavailable.
    }
    setAdminKey('')
  }

  if (!adminKey) {
    return <AdminGate onAuthenticated={authenticate} />
  }

  const departments = departmentsApi.data || []
  const meta = metaApi.data
  const metaError = metaApi.error

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Restricted · Academic operations"
        title="Admin workspace"
        description="Create complete student records, correct results, maintain profiles, and review every change in the audit trail."
        action={
          <button type="button" onClick={lock} className={secondaryButton}>
            Lock admin
          </button>
        }
      />

      <div className="mt-2 flex flex-col gap-5 border-y border-line py-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:w-[22rem]">
          <label htmlFor="admin-branch" className="label mb-1.5 block">
            Branch
          </label>
          <select
            id="admin-branch"
            value={branch}
            disabled={departmentsApi.loading}
            onChange={(event) => setBranch(event.target.value)}
            className="h-10 w-full rounded-[4px] border border-line bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25"
          >
            {departments.length === 0 && <option value={branch}>{branch}</option>}
            {departments.map((department) => (
              <option key={department.code} value={department.code}>
                {department.code} · {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-[19rem]">
          <p className="label mb-1.5">Semester</p>
          <SemesterSwitch value={semester} onChange={setSemester} />
        </div>
        <div className="hidden items-center gap-2 pb-1 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          <span className="num text-[11px] uppercase tracking-[0.1em] text-muted">
            Authenticated · Semester {semesterLabel(semester)}
          </span>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="mt-6 flex flex-wrap items-center gap-1 border-b border-line"
      >
        {tabs.map((item) => {
          const selected = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-3 py-3 text-[12.5px] font-medium transition-colors ${
                selected
                  ? 'border-forest text-forest'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-6">
        {tab === 'activity' ? (
          <AdminActivityTab adminKey={adminKey} onLock={lock} />
        ) : metaApi.loading ? (
          <LoadingBlock label="Loading admin catalogue" />
        ) : metaError ? (
          <ErrorPanel
            error={metaError}
            onRetry={metaError.status === 401 ? lock : metaApi.reload}
            title={
              metaError.status === 401
                ? 'Admin passcode was rejected'
                : 'Admin catalogue could not be loaded'
            }
          />
        ) : tab === 'students' ? (
          <AdminStudentsTab
            adminKey={adminKey}
            branch={branch}
            semester={semester}
            meta={meta}
          />
        ) : (
          <AdminResultsTab
            adminKey={adminKey}
            branch={branch}
            semester={semester}
            meta={meta}
          />
        )}
      </div>
    </div>
  )
}
