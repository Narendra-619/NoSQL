import { Link, Outlet, useLocation } from 'react-router-dom'
import ModeSwitch from './ModeSwitch.jsx'

function activeMode(location) {
  if (location.pathname.startsWith('/department')) return 'department'
  if (location.pathname.startsWith('/students')) return location.state?.mode || 'department'
  if (location.pathname.startsWith('/principal')) return 'principal'
  if (location.pathname.startsWith('/admin')) return 'admin'
  return undefined
}

export default function Layout() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="material sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="wrap flex items-center justify-between gap-4 py-3.5">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-muted transition-colors hover:text-forest"
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:-translate-x-0.5"
            >
              ←
            </span>
            Home
          </Link>
          <ModeSwitch active={activeMode(location)} />
        </div>
      </header>
      <main id="main-content" className="wrap flex-1 py-8 md:py-12">
        <Outlet />
      </main>
    </div>
  )
}
