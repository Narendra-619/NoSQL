import { SEMESTERS, semesterLabel } from '../../lib/format.js'

export default function SemesterSwitch({ value, onChange, className = '' }) {
  return (
    <div
      role="group"
      aria-label="Semester"
      className={`inline-flex h-10 w-full items-center rounded-[4px] border border-line bg-surface p-0.5 ${className}`}
    >
      {SEMESTERS.map((semester) => {
        const selected = value === semester
        return (
          <button
            key={semester}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(semester)}
            className={`h-full flex-1 rounded-[3px] text-[12.5px] font-medium transition-colors ${
              selected
                ? 'bg-forest text-paper'
                : 'text-ink-soft hover:bg-surface-2/80 hover:text-ink'
            }`}
          >
            Sem {semesterLabel(semester)}
          </button>
        )
      })}
    </div>
  )
}
