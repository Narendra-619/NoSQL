export const SEMESTERS = [1, 2, 3, 4]

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(value) {
  return `${formatNumber(value, 1)}%`
}

export function formatCgpa(value) {
  return formatNumber(value, 2)
}

export function semesterLabel(semester) {
  return String(semester)
}

export function plural(value, singular, pluralForm = `${singular}s`) {
  return value === 1 ? singular : pluralForm
}
