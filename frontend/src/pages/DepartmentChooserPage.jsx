import { Link } from 'react-router-dom'
import { EmptyPanel, ErrorPanel, LoadingBlock } from '../components/common/Feedback.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import { getDepartments } from '../lib/api.js'
import { formatNumber, plural, semesterLabel } from '../lib/format.js'
import { useApi } from '../hooks/useApi.js'

const SEMESTER = 4

export default function DepartmentChooserPage() {
  const { data, loading, error, reload } = useApi(
    (signal) => getDepartments(SEMESTER, signal),
    [],
  )
  const departments = data || []
  const totalStudents = departments.reduce((sum, item) => sum + item.student_count, 0)

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Branch workspace"
        title="Choose a branch"
        description={`Open a branch-level view of Semester ${semesterLabel(SEMESTER)} results, subject outcomes, and the student register.`}
      />

      {loading && <LoadingBlock label="Loading departments" />}
      {error && <ErrorPanel error={error} onRetry={reload} title="Branches could not be loaded" />}
      {!loading && !error && departments.length === 0 && (
        <EmptyPanel
          title="No branches are available"
          body="The branch catalogue is empty in the current dataset."
        />
      )}

      {!loading && !error && departments.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-4">
            <p className="label">{departments.length} branches</p>
            <p className="num text-[11.5px] text-muted">
              {formatNumber(totalStudents)} {plural(totalStudents, 'student')} · Semester{' '}
              {semesterLabel(SEMESTER)}
            </p>
          </div>
          <div>
            {departments.map((department) => (
              <Link
                key={department.code}
                to={`/department/${department.code}`}
                className="group grid grid-cols-[3.4rem_1fr_auto] items-center gap-x-4 border-b border-line py-5 transition-colors hover:bg-surface/60 sm:grid-cols-[4rem_1fr_10rem_auto] md:py-6"
              >
                <span className="num self-start pt-0.5 text-[12px] font-semibold tracking-[0.02em] text-forest sm:self-center sm:pt-0">
                  {department.code}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-[1.45rem] leading-tight tracking-[-0.02em] text-ink transition-colors group-hover:text-forest">
                    {department.name}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="num block text-[13.5px] font-medium text-ink">
                    {formatNumber(department.student_count)}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.1em] text-muted">
                    Students
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="self-start pt-1 text-[15px] text-forest transition-transform duration-150 group-hover:translate-x-0.5 sm:self-center sm:pt-0"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
