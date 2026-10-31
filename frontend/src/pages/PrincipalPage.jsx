import { Link } from 'react-router-dom'
import { ErrorPanel, LoadingBlock, MetricSkeleton } from '../components/common/Feedback.jsx'
import MetricStrip from '../components/common/MetricStrip.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import RateBar from '../components/common/RateBar.jsx'
import Section from '../components/common/Section.jsx'
import StudentRegister from '../components/students/StudentRegister.jsx'
import { useApi } from '../hooks/useApi.js'
import { useStudentFilters, studentQueryParams } from '../hooks/useStudentFilters.js'
import { getDepartmentComparison, getDepartments, getOverview, getStudents } from '../lib/api.js'
import {
  formatCgpa,
  formatNumber,
  formatPercent,
  semesterLabel,
} from '../lib/format.js'

export default function PrincipalPage() {
  const { filters, update, updateRange, reset, activeCount } = useStudentFilters()
  const queryParams = studentQueryParams(filters)
  const queryKey = JSON.stringify(queryParams)
  const semester = filters.semester

  const departmentsApi = useApi(
    (signal) => getDepartments(semester, signal),
    [semester],
  )
  const studentsApi = useApi((signal) => getStudents(queryParams, signal), [queryKey])
  const overviewApi = useApi(
    (signal) =>
      getOverview(
        { semester, department: filters.department || undefined },
        signal,
      ),
    [semester, filters.department],
  )
  const comparisonApi = useApi(
    (signal) => getDepartmentComparison(semester, signal),
    [semester],
  )

  const overview = overviewApi.data
  const selectedDepartment = departmentsApi.data?.find(
    (item) => item.code === filters.department,
  )
  const comparison = comparisonApi.data?.departments || []

  const metrics = overview
    ? [
        {
          label: 'Passed',
          value: formatNumber(overview.pass_count),
          note: `of ${formatNumber(overview.student_count)} in Semester ${semesterLabel(semester)}`,
        },
        {
          label: 'Failed',
          value: formatNumber(overview.fail_count),
          note: `${formatPercent(100 - overview.pass_percentage)} of the semester`,
        },
        {
          label: 'Average CGPA',
          value: formatCgpa(overview.average_cgpa),
          note: 'Mean cumulative CGPA',
        },
        {
          label: 'With backlogs',
          value: formatNumber(overview.students_with_backlogs),
          note: `Average ${formatNumber(overview.average_backlogs, 2)} per student`,
        },
      ]
    : []

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Principal · College oversight"
        title="Academic performance"
        description="Semester results across the institution, with branch comparison and a full student register."
        action={
          <Link
            to="/department"
            className="text-[12.5px] font-medium text-muted underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest"
          >
            Branch workspaces
          </Link>
        }
      />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label">
          {selectedDepartment
            ? `${selectedDepartment.code} · ${selectedDepartment.name}`
            : 'All branches'}
        </p>
        <p className="num text-[11.5px] text-muted">
          Semester {semesterLabel(semester)}
        </p>
      </div>

      <div className="mt-3">
        {overviewApi.loading && <MetricSkeleton />}
        {!overviewApi.loading && overviewApi.error && (
          <ErrorPanel
            error={overviewApi.error}
            onRetry={overviewApi.reload}
            title="Semester metrics could not be loaded"
          />
        )}
        {!overviewApi.loading && !overviewApi.error && overview && (
          <MetricStrip items={metrics} />
        )}
      </div>

      <Section
        id="department-comparison"
        eyebrow="Comparison"
        title="Branches this semester"
        className="mt-9"
      >
        {comparisonApi.loading && <LoadingBlock label="Comparing departments" />}
        {!comparisonApi.loading && comparisonApi.error && (
          <ErrorPanel
            error={comparisonApi.error}
            onRetry={comparisonApi.reload}
            title="Branch comparison could not be loaded"
          />
        )}
        {!comparisonApi.loading && !comparisonApi.error && comparison.length === 0 && (
          <p className="border-y border-line py-8 text-[13px] text-muted">
            No branch results are available for this semester.
          </p>
        )}
        {!comparisonApi.loading && !comparisonApi.error && comparison.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <caption className="sr-only">
                Branch comparison for Semester {semesterLabel(semester)}
              </caption>
              <thead>
                <tr className="border-y border-line">
                  <th scope="col" className="label px-3 py-3 font-semibold">Branch</th>
                  <th scope="col" className="label px-3 py-3 text-right font-semibold">Students</th>
                  <th scope="col" className="label px-3 py-3 text-right font-semibold">Avg CGPA</th>
                  <th scope="col" className="label px-3 py-3 font-semibold">Pass rate</th>
                  <th scope="col" className="label px-3 py-3 text-right font-semibold">With backlogs</th>
                  <th scope="col" className="label px-3 py-3 text-right font-semibold">Backlog rate</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((item) => {
                  const selected = filters.department === item.department_code
                  return (
                    <tr
                      key={item.department_code}
                      className={`border-b border-line/80 transition-colors ${
                        selected ? 'bg-forest-soft/45' : 'hover:bg-surface/70'
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <Link
                          to={`/department/${item.department_code}?semester=${semester}`}
                          className="inline-flex items-baseline gap-2 text-[13px] font-medium text-ink hover:text-forest"
                        >
                          <span className="num text-[11px] text-muted">{item.department_code}</span>
                          {item.department_name}
                        </Link>
                      </td>
                      <td className="num px-3 py-3.5 text-right text-[13px] text-ink-soft">
                        {formatNumber(item.student_count)}
                      </td>
                      <td className="num px-3 py-3.5 text-right text-[13px] font-semibold text-ink">
                        {formatCgpa(item.average_cgpa)}
                      </td>
                      <td className="px-3 py-3.5">
                        <RateBar value={item.pass_percentage} />
                      </td>
                      <td className="num px-3 py-3.5 text-right text-[13px] text-ink-soft">
                        {formatNumber(item.students_with_backlogs)}
                      </td>
                      <td className="num px-3 py-3.5 text-right text-[13px] text-muted">
                        {formatPercent(item.backlog_rate)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="mt-9">
        <StudentRegister
          data={studentsApi.data}
          loading={studentsApi.loading}
          error={studentsApi.error}
          reload={studentsApi.reload}
          filters={filters}
          update={update}
          updateRange={updateRange}
          reset={reset}
          activeCount={activeCount}
          departments={departmentsApi.data || []}
          departmentsLoading={departmentsApi.loading}
          showDepartment
          mode="principal"
        />
      </div>
    </div>
  )
}
