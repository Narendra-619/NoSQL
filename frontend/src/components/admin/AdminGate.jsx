import { useState } from 'react'
import { Link } from 'react-router-dom'

import { verifyAdmin } from '../../lib/api.js'
import { inputClass, primaryButton } from './adminStyles.js'

export default function AdminGate({ onAuthenticated }) {
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    if (!adminKey.trim()) {
      setError('Enter the admin passcode to continue.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await verifyAdmin(adminKey.trim())
      onAuthenticated(adminKey.trim())
    } catch (requestError) {
      setError(
        requestError.status === 401
          ? 'That passcode was not accepted.'
          : requestError.message,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter mx-auto max-w-md py-8 md:py-14">
      <p className="label">Restricted workspace</p>
      <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,3.2rem)] leading-[1.02] tracking-[-0.035em] text-ink">
        Admin access
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Enter the passcode configured for this environment. The key is kept in
        this browser tab only and is not stored with student records.
      </p>

      <form onSubmit={onSubmit} className="mt-8 border-y border-line py-6">
        <label htmlFor="admin-passcode" className="label mb-1.5 block">
          Admin passcode
        </label>
        <input
          id="admin-passcode"
          type="password"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          autoComplete="current-password"
          autoFocus
          className={inputClass}
          placeholder="Enter passcode"
        />
        {error && (
          <p role="alert" className="mt-2 text-[12px] text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className={`${primaryButton} mt-4 w-full`}>
          {loading ? 'Checking access…' : 'Unlock admin'}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
        <span>Passcode is read from the server environment.</span>
        <Link
          to="/"
          className="font-medium underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest"
        >
          Return home
        </Link>
      </div>
    </div>
  )
}
