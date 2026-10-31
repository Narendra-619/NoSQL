export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Student list pagination" className="flex items-center justify-between gap-4 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-[4px] border border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
      >
        Previous
      </button>
      <p className="num text-[12px] text-muted" aria-live="polite">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-[4px] border border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
      >
        Next
      </button>
    </nav>
  )
}
