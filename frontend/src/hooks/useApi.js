import { useCallback, useEffect, useState } from 'react'

export function useApi(requestFactory, deps) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  })
  const [revision, setRevision] = useState(0)

  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    // A new request intentionally enters the loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((current) => ({ ...current, loading: true, error: null }))
    requestFactory(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ data: null, loading: false, error })
      })
    return () => {
      active = false
      controller.abort()
    }
    // Callers provide the values that identify the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision])

  return { ...state, reload }
}
