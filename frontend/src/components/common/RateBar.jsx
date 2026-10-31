import { formatPercent } from '../../lib/format.js'

export default function RateBar({ value, danger = false, width = 'w-28' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="flex items-center gap-2.5">
      <div className={`bar-track ${width}`}>
        <div
          className={`bar-fill ${danger ? 'bar-fill-danger' : ''}`}
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="num w-12 text-right text-[12px] text-ink-soft">{formatPercent(value)}</span>
    </div>
  )
}
