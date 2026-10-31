export default function StatusBadge({ status, compact = false }) {
  const pass = status === 'PASS'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 ${
        compact ? 'py-0.5 text-[10px]' : 'py-1 text-[11px]'
      } font-semibold tracking-[0.02em] ${
        pass ? 'bg-forest-soft text-forest' : 'bg-danger-soft text-danger'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${pass ? 'bg-success' : 'bg-danger'}`}
      />
      {pass ? 'Pass' : 'Fail'}
    </span>
  )
}
