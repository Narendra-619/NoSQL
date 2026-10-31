import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { SEMESTERS } from '../lib/format.js'

const DEFAULTS = {
  semester: 4,
  department: '',
  cgpaMin: '',
  cgpaMax: '',
  backlog: '',
  status: '',
  sort: 'roll_asc',
  page: 1,
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

export function useStudentFilters({ lockedDepartment = null } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const semester = Number(searchParams.get('semester'))
  const page = Number(searchParams.get('page'))
  const filters = {
    semester: SEMESTERS.includes(semester) ? semester : DEFAULTS.semester,
    department: lockedDepartment || searchParams.get('department') || '',
    cgpaMin: searchParams.get('cgpa_min') || '',
    cgpaMax: searchParams.get('cgpa_max') || '',
    backlog: oneOf(searchParams.get('backlog') || '', ['', 'none', '1', '2', '3'], ''),
    status: oneOf(searchParams.get('status') || '', ['', 'PASS', 'FAIL'], ''),
    sort: oneOf(
      searchParams.get('sort') || 'roll_asc',
      ['roll_asc', 'cgpa_desc', 'cgpa_asc', 'backlogs_desc'],
      'roll_asc',
    ),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }

  const update = useCallback(
    (key, value) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (value === '' || value === null || value === undefined || value === DEFAULTS[key]) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const updateRange = useCallback(
    (min, max) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (min === '') next.delete('cgpa_min')
          else next.set('cgpa_min', String(min))
          if (max === '') next.delete('cgpa_max')
          else next.set('cgpa_max', String(max))
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const activeCount = [
    filters.department && !lockedDepartment,
    filters.cgpaMin,
    filters.cgpaMax,
    filters.backlog,
    filters.status,
    filters.sort !== 'roll_asc',
  ].filter(Boolean).length

  return { filters, update, updateRange, reset, activeCount }
}

export function studentQueryParams(filters) {
  const params = {
    semester: filters.semester,
    department: filters.department || undefined,
    status: filters.status || undefined,
    sort: filters.sort,
    page: filters.page,
    page_size: 25,
  }
  if (filters.cgpaMin !== '') params.cgpa_min = Number(filters.cgpaMin)
  if (filters.cgpaMax !== '') params.cgpa_max = Number(filters.cgpaMax)
  if (filters.backlog === 'none') params.backlog_max = 0
  if (filters.backlog === '1') params.backlog_min = 1
  if (filters.backlog === '2') params.backlog_min = 2
  if (filters.backlog === '3') params.backlog_min = 3
  return params
}

