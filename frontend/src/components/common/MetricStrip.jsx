export default function MetricStrip({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-y border-line bg-line md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-paper px-3.5 py-4 md:px-5 md:py-5">
          <dt className="label text-[10px]">{item.label}</dt>
          <dd className="mt-2 flex items-baseline gap-1.5">
            <span className="num text-[1.65rem] font-semibold leading-none tracking-[-0.025em] text-ink md:text-[1.9rem]">
              {item.value}
            </span>
            {item.suffix && (
              <span className="text-[12px] font-medium text-muted">{item.suffix}</span>
            )}
          </dd>
          <dd className="mt-2 min-h-[1.1rem] text-[11.5px] leading-snug text-muted">
            {item.note || '\u00A0'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
