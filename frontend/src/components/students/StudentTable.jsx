import { Link, useLocation } from 'react-router-dom'
import { formatCgpa } from '../../lib/format.js'
import StatusBadge from '../common/StatusBadge.jsx'

export default function StudentTable({ items, showDepartment = false, mode = 'principal' }) {
  const location = useLocation()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">
          Student academic summary. Select a student to open the full profile.
        </caption>
        <thead>
          <tr className="border-y border-line text-muted">
            <th scope="col" className="label px-3 py-3 font-semibold">
              Roll number
            </th>
            <th scope="col" className="label px-3 py-3 font-semibold">
              Student
            </th>
            {showDepartment && (
              <th scope="col" className="label px-3 py-3 font-semibold">
                Branch
              </th>
            )}
            <th scope="col" className="label px-3 py-3 text-right font-semibold">
              CGPA
            </th>
            <th scope="col" className="label px-3 py-3 text-center font-semibold">
              Result
            </th>
            <th scope="col" className="label px-3 py-3 text-right font-semibold">
              Backlogs
            </th>
            <th scope="col" className="label px-3 py-3 text-right font-semibold">
              <span className="sr-only">Profile</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((student) => (
            <tr
              key={student.student_id}
              className="border-b border-line/80 transition-colors hover:bg-surface/80"
            >
              <td className="num whitespace-nowrap px-3 py-3.5 text-[12.5px] text-muted">
                {student.roll_number}
              </td>
              <td className="px-3 py-3.5 text-[13.5px] font-medium text-ink">
                {student.name}
              </td>
              {showDepartment && (
                <td className="whitespace-nowrap px-3 py-3.5 text-[12.5px] text-ink-soft">
                  {student.department_name}
                </td>
              )}
              <td className="num px-3 py-3.5 text-right text-[13.5px] font-semibold text-ink">
                {formatCgpa(student.cgpa)}
              </td>
              <td className="px-3 py-3.5 text-center">
                <StatusBadge status={student.result_status} compact />
              </td>
              <td
                className={`num px-3 py-3.5 text-right text-[13px] ${
                  student.backlog_count > 0
                    ? 'font-semibold text-danger'
                    : 'text-muted'
                }`}
              >
                {student.backlog_count}
              </td>
              <td className="px-3 py-3.5 text-right">
                <Link
                  to={`/students/${student.student_id}`}
                  state={{
                    from: `${location.pathname}${location.search}`,
                    mode,
                  }}
                  aria-label={`Open profile for ${student.name}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-forest underline decoration-forest/25 underline-offset-4 transition-colors hover:decoration-forest"
                >
                  View
                  <span aria-hidden="true">→</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
