import { EmptyPanel, ErrorPanel, TableSkeleton } from '../common/Feedback.jsx'
import FilterBar from './FilterBar.jsx'
import Pagination from '../common/Pagination.jsx'
import StudentTable from './StudentTable.jsx'
import { formatNumber } from '../../lib/format.js'

export default function StudentRegister({
  data,
  loading,
  error,
  reload,
  filters,
  update,
  updateRange,
  reset,
  activeCount,
  departments,
  departmentsLoading,
  showSemester = true,
  showDepartment,
  mode,
}) {
  const total = data?.total ?? 0
  const page = data?.page ?? filters.page
  const pageSize = data?.page_size ?? 25
  const totalPages = data?.total_pages ?? 0
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <section aria-labelledby="register-title" className="border-t border-line pt-6 md:pt-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Student records</p>
          <h2
            id="register-title"
            className="mt-1.5 font-serif text-[1.45rem] leading-tight tracking-[-0.015em] text-ink md:text-[1.6rem]"
          >
            Student register
          </h2>
        </div>
        <p className="num text-[11.5px] text-muted" aria-live="polite">
          {loading
            ? 'Reading records'
            : error
              ? 'Records unavailable'
              : total === 0
                ? 'No matching records'
                : `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}`}
        </p>
      </div>

      <FilterBar
        filters={filters}
        update={update}
        updateRange={updateRange}
        reset={reset}
        activeCount={activeCount}
        departments={departments}
        departmentsLoading={departmentsLoading}
        showSemester={showSemester}
        showDepartment={showDepartment}
      />

      {loading && <TableSkeleton />}
      {!loading && error && (
        <ErrorPanel error={error} onRetry={reload} title="Student records could not be loaded" />
      )}
      {!loading && !error && total === 0 && (
        <EmptyPanel
          title="No students match these filters"
          body="Widen the CGPA range, clear the backlog or result filter, or choose another branch."
          action={
            activeCount > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="mt-5 rounded-[4px] border border-line-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-forest hover:text-forest"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      )}
      {!loading && !error && total > 0 && (
        <>
          <StudentTable
            items={data.items}
            showDepartment={showDepartment}
            mode={mode}
          />
          <Pagination page={page} totalPages={totalPages} onPage={(next) => update('page', next)} />
        </>
      )}
    </section>
  )
}
