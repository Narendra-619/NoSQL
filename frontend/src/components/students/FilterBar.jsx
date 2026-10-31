import { useRef, useState } from 'react'
import SemesterSwitch from './SemesterSwitch.jsx'

const control =
  'h-10 w-full rounded-[4px] border border-line bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25'

function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label mb-1.5" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function FilterBar({
  filters,
  update,
  updateRange,
  reset,
  activeCount,
  departments = [],
  showSemester = true,
  showDepartment = false,
  departmentsLoading = false,
}) {
  const minRef = useRef(null)
  const maxRef = useRef(null)
  const [rangeError, setRangeError] = useState(false)
  const standalone = !showSemester && !showDepartment

  function commitRange() {
    const min = minRef.current?.value ?? ''
    const max = maxRef.current?.value ?? ''
    const invalid = min !== '' && max !== '' && Number(min) > Number(max)
    setRangeError(invalid)
    if (!invalid) updateRange(min, max)
  }

  function onRangeKeyDown(event) {
    if (event.key === 'Enter') commitRange()
  }

  return (
    <div className="border-y border-line py-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4 xl:grid-cols-12">
        {showSemester && (
          <Field label="Semester" className="xl:col-span-2">
            <SemesterSwitch
              value={filters.semester}
              onChange={(semester) => update('semester', semester)}
            />
          </Field>
        )}

        {showDepartment && (
          <Field label="Branch" htmlFor="filter-department" className="xl:col-span-2">
            <select
              id="filter-department"
              value={filters.department}
              disabled={departmentsLoading}
              onChange={(event) => update('department', event.target.value)}
              className={control}
            >
              <option value="">
                {departmentsLoading ? 'Loading branches…' : 'All branches'}
              </option>
              {departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.code} · {department.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="CGPA range"
          className={`col-span-2 ${standalone ? 'xl:col-span-4' : 'xl:col-span-3'}`}
        >
          <div className="flex items-center gap-2">
            <input
              key={`min-${filters.cgpaMin}`}
              ref={minRef}
              type="number"
              inputMode="decimal"
              min="0"
              max="10"
              step="0.01"
              defaultValue={filters.cgpaMin}
              onBlur={commitRange}
              onKeyDown={onRangeKeyDown}
              aria-label="Minimum CGPA"
              placeholder="Min"
              className={`${control} num`}
            />
            <span className="text-muted" aria-hidden="true">
              –
            </span>
            <input
              key={`max-${filters.cgpaMax}`}
              ref={maxRef}
              type="number"
              inputMode="decimal"
              min="0"
              max="10"
              step="0.01"
              defaultValue={filters.cgpaMax}
              onBlur={commitRange}
              onKeyDown={onRangeKeyDown}
              aria-label="Maximum CGPA"
              placeholder="Max"
              className={`${control} num`}
            />
          </div>
          {rangeError && (
            <p className="mt-1.5 text-[11px] text-danger" role="alert">
              Minimum cannot exceed maximum.
            </p>
          )}
        </Field>

        <Field
          label="Backlogs"
          htmlFor="filter-backlogs"
          className={standalone ? 'xl:col-span-3' : 'xl:col-span-2'}
        >
          <select
            id="filter-backlogs"
            value={filters.backlog}
            onChange={(event) => update('backlog', event.target.value)}
            className={control}
          >
            <option value="">Any</option>
            <option value="none">None</option>
            <option value="1">1 or more</option>
            <option value="2">2 or more</option>
            <option value="3">3 or more</option>
          </select>
        </Field>

        <Field
          label="Result"
          htmlFor="filter-status"
          className={standalone ? 'xl:col-span-2' : 'xl:col-span-1'}
        >
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => update('status', event.target.value)}
            className={control}
          >
            <option value="">Any</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </Field>

        <Field
          label="Order"
          htmlFor="filter-sort"
          className={standalone ? 'xl:col-span-3' : 'xl:col-span-2'}
        >
          <select
            id="filter-sort"
            value={filters.sort}
            onChange={(event) => update('sort', event.target.value)}
            className={control}
          >
            <option value="roll_asc">Roll number</option>
            <option value="cgpa_desc">CGPA, high to low</option>
            <option value="cgpa_asc">CGPA, low to high</option>
            <option value="backlogs_desc">Backlogs, high to low</option>
          </select>
        </Field>
      </div>

      {activeCount > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="text-[12px] font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-forest hover:decoration-forest"
          >
            Clear {activeCount} {activeCount === 1 ? 'filter' : 'filters'}
          </button>
        </div>
      )}
    </div>
  )
}
