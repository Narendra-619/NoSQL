import { Link } from 'react-router-dom'

const items = [
  { key: 'principal', label: 'Principal', to: '/principal' },
  { key: 'department', label: 'Branch', to: '/department' },
  { key: 'admin', label: 'Admin', to: '/admin' },
]

export default function ModeSwitch({ active }) {
  return (
    <nav
      aria-label="Workspace mode"
      className="inline-flex items-center rounded-full border border-line bg-surface/70 p-0.5"
    >
      {items.map((item) => {
        const selected = active === item.key
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={selected ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
              selected
                ? 'bg-forest text-paper shadow-[0_1px_0_rgba(20,52,40,0.22)]'
                : 'text-ink-soft hover:bg-surface-2/70 hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
