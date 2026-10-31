import { ApiError } from '../../lib/api.js'

export function LoadingBlock({ label = 'Loading academic records' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-y border-line px-1 py-10 text-[13px] text-muted"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-forest" aria-hidden="true" />
      {label}
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px border-y border-line bg-line md:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="bg-paper px-4 py-5">
          <span className="skeleton block h-2.5 w-20" />
          <span className="skeleton mt-3 block h-7 w-16" />
          <span className="skeleton mt-3 block h-2.5 w-24" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div role="status" aria-label="Loading student records" className="border-y border-line">
      <div className="grid grid-cols-[5rem_1fr_6rem_5rem_5rem] gap-4 border-b border-line px-3 py-3">
        {['w-10', 'w-28', 'w-12', 'w-10', 'w-12'].map((width, index) => (
          <span key={index} className={`skeleton h-2.5 ${width}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid grid-cols-[5rem_1fr_6rem_5rem_5rem] gap-4 border-b border-line/70 px-3 py-4 last:border-0"
        >
          <span className="skeleton h-3 w-14" />
          <span className={`skeleton h-3 ${row % 3 === 0 ? 'w-40' : 'w-32'}`} />
          <span className="skeleton h-3 w-16" />
          <span className="skeleton h-3 w-10" />
          <span className="skeleton h-5 w-14 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading student records</span>
    </div>
  )
}

export function ErrorPanel({ error, onRetry, title = 'This view could not be loaded' }) {
  const detail =
    error instanceof ApiError && error.status === 404
      ? 'The requested record does not exist in the current dataset.'
      : error?.message || 'The academic service did not respond. Check that the API is running and try again.'
  return (
    <div role="alert" className="border-y border-line py-10">
      <p className="label text-danger">Request failed</p>
      <h3 className="mt-2 font-serif text-xl text-ink">{title}</h3>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">{detail}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-[4px] border border-line-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-forest hover:text-forest"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyPanel({ title, body, action }) {
  return (
    <div className="border-y border-line py-10">
      <p className="label">No records</p>
      <h3 className="mt-2 font-serif text-xl text-ink">{title}</h3>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  )
}
