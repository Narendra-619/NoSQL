import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorPanel, LoadingBlock, MetricSkeleton } from '../components/common/Feedback.jsx'
import MetricStrip from '../components/common/MetricStrip.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import RateBar from '../components/common/RateBar.jsx'
import Section from '../components/common/Section.jsx'
import SemesterSwitch from '../components/students/SemesterSwitch.jsx'
import StudentRegister from '../components/students/StudentRegister.jsx'
import SubjectFailures from '../components/students/SubjectFailures.jsx'
import { useApi } from '../hooks/useApi.js'
import { studentQueryParams, useStudentFilters } from '../hooks/useStudentFilters.js'
import {
  getDepartments,
  getOverview,
  getStudents,
  getSubjectAnalytics,
  getTrends,
} from '../lib/api.js'
import {
  formatCgpa,
  formatNumber,
  formatPercent,
  semesterLabel,
} from '../lib/format.js'

function signed(value, digits = 2) {
  const number = Number(value) || 0
  const prefix = number > 0 ? '+' : ''
  return `${prefix}${formatNumber(number, digits)}`
}

export default function DepartmentPage() {
  const { departmentCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { filters, update, updateRange, reset, activeCount } = useStudentFilters({
    lockedDepartment: departmentCode,
  })
  const queryParams = studentQueryParams(filters)
  const queryKey = JSON.stringify(queryParams)
  const semester = filters.semester

  const departmentsApi = useApi((signal) => getDepartments(semester, signal), [semester])
  const overviewApi = useApi(
    (signal) => getOverview({ semester, department: departmentCode }, signal),
    [semester, departmentCode],
  )
  const trendsApi = useApi(
    (signal) => getTrends(departmentCode, signal),
    [departmentCode],
  )
  const subjectsApi = useApi(
    (signal) => getSubjectAnalytics(departmentCode, semester, signal),
    [departmentCode, semester],
  )
  const studentsApi = useApi((signal) => getStudents(queryParams, signal), [queryKey])

  const subjectRows = subjectsApi.data?.subjects || []
  const department = departmentsApi.data?.find((item) => item.code === departmentCode)
  const overview = overviewApi.data
  const trends = trendsApi.data?.semesters || []
  const firstTrend = trends[0]
  const latestTrend = trends[trends.length - 1]
  const cgpaDelta =
    firstTrend && latestTrend ? latestTrend.average_cgpa - firstTrend.average_cgpa : 0
  const passDelta =
    firstTrend && latestTrend ? latestTrend.pass_percentage - firstTrend.pass_percentage : 0

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

  function switchDepartment(event) {
    const next = event.target.value
    const nextSearch = new URLSearchParams(location.search)
    nextSearch.delete('department')
    nextSearch.delete('page')
    const query = nextSearch.toString()
    navigate(`/department/${next}${query ? `?${query}` : ''}`)
  }

  if (!departmentsApi.loading && !departmentsApi.error && departmentsApi.data && !department) {
    return (
      <div className="page-enter">
        <PageHeader
          eyebrow="Branch workspace"
          title="Branch not found"
          description={`No branch with the code ${departmentCode} is present in the current catalogue.`}
        />
        <div className="border-t border-line pt-6">
          <Link
            to="/department"
            className="text-[13px] font-medium text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest"
          >
            Choose another branch
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Branch workspace"
        title={department?.name || departmentCode}
      />

      <div className="mt-2 flex flex-col gap-5 border-y border-line py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-[13rem]">
          <p className="label mb-1.5">Semester</p>
          <SemesterSwitch
            value={semester}
            onChange={(next) => update('semester', next)}
          />
        </div>
        <div className="w-full sm:w-[20rem]">
          <label htmlFor="switch-department" className="label mb-1.5">
            Switch branch
          </label>
          <select
            id="switch-department"
            value={departmentCode}
            disabled={departmentsApi.loading}
            onChange={switchDepartment}
            className="h-10 w-full rounded-[4px] border border-line bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25"
          >
            {departmentsApi.data?.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
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

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section
          id="subject-performance"
          eyebrow="Outcomes"
          title="Subject performance"
        >
          {subjectsApi.loading && <LoadingBlock label="Loading subject outcomes" />}
          {!subjectsApi.loading && subjectsApi.error && (
            <ErrorPanel
              error={subjectsApi.error}
              onRetry={subjectsApi.reload}
              title="Subject outcomes could not be loaded"
            />
          )}
          {!subjectsApi.loading && !subjectsApi.error && subjectRows.length === 0 && (
            <p className="border-y border-line py-8 text-[13px] text-muted">
              No subject results are available for this semester.
            </p>
          )}
          {!subjectsApi.loading && !subjectsApi.error && subjectRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <caption className="sr-only">
                  Subject outcomes for Semester {semesterLabel(semester)}
                </caption>
                <thead>
                  <tr className="border-y border-line">
                    <th scope="col" className="label px-2.5 py-3 font-semibold">Subject</th>
                    <th scope="col" className="label px-2.5 py-3 text-right font-semibold">Appeared</th>
                    <th scope="col" className="label px-2.5 py-3 text-right font-semibold">Failed</th>
                    <th scope="col" className="label px-2.5 py-3 font-semibold">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((subject) => (
                    <tr key={subject.subject_code} className="border-b border-line/80 hover:bg-surface/70">
                      <td className="px-2.5 py-3">
                        <span className="num block text-[10.5px] tracking-[0.04em] text-muted">
                          {subject.subject_code}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] font-medium text-ink">
                          {subject.subject_name}
                        </span>
                      </td>
                      <td className="num px-2.5 py-3 text-right text-[12.5px] text-ink-soft">
                        {formatNumber(subject.appeared)}
                      </td>
                      <td
                        className={`num px-2.5 py-3 text-right text-[12.5px] ${
                          subject.failed > 0 ? 'font-semibold text-danger' : 'text-muted'
                        }`}
                      >
                        {formatNumber(subject.failed)}
                      </td>
                      <td className="px-2.5 py-3">
                        <RateBar value={subject.pass_percentage} width="w-20" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section eyebrow="Movement" title="Semester trend">
          {trendsApi.loading && <LoadingBlock label="Loading semester trend" />}
          {!trendsApi.loading && trendsApi.error && (
            <ErrorPanel
              error={trendsApi.error}
              onRetry={trendsApi.reload}
              title="Semester trend could not be loaded"
            />
          )}
          {!trendsApi.loading && !trendsApi.error && trends.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between border-b border-line pb-4">
                <div>
                  <p className="label">CGPA movement</p>
                  <p
                    className={`num mt-1.5 text-[1.6rem] font-semibold leading-none ${
                      cgpaDelta >= 0 ? 'text-forest' : 'text-danger'
                    }`}
                  >
                    {signed(cgpaDelta)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="label">Pass rate</p>
                  <p
                    className={`num mt-1.5 text-[1.2rem] font-semibold leading-none ${
                      passDelta >= 0 ? 'text-forest' : 'text-danger'
                    }`}
                  >
                    {signed(passDelta, 1)} pts
                  </p>
                </div>
              </div>
              <dl>
                {trends.map((trend) => (
                  <div
                    key={trend.semester}
                    className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-3.5 last:border-0"
                  >
                    <dt>
                      <span className="block text-[12.5px] font-medium text-ink">
                        Semester {semesterLabel(trend.semester)}
                      </span>
                      <span className="num mt-0.5 block text-[10.5px] text-muted">
                        {formatNumber(trend.students_with_backlogs)} with backlogs
                      </span>
                    </dt>
                    <dd className="text-right">
                      <span className="num block text-[14px] font-semibold text-ink">
                        {formatCgpa(trend.average_cgpa)}
                      </span>
                      <span className="num mt-0.5 block text-[10.5px] text-muted">
                        {formatPercent(trend.pass_percentage)} pass
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
                Cumulative CGPA is averaged across students; pass rate is per semester.
              </p>
            </div>
          )}
        </Section>
      </div>

      {subjectRows.length > 0 && (
        <SubjectFailures
          department={departmentCode}
          semester={semester}
          subjects={subjectRows}
        />
      )}

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
          showSemester={false}
          showDepartment={false}
          mode="department"
        />
      </div>
    </div>
  )
}
