const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorDetail(body) {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail) && body.detail.length > 0) {
    const first = body.detail[0]
    if (typeof first === 'string') return first
    if (typeof first?.msg === 'string') {
      const location = Array.isArray(first.loc) ? first.loc.slice(1).join('.') : ''
      return location ? `${location}: ${first.msg}` : first.msg
    }
  }
  return null
}

async function requestJson(
  path,
  { method = 'GET', params, body, adminKey, signal } = {},
) {
  const url = new URL(`${API_BASE}/api${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (adminKey) headers['X-Admin-Key'] = adminKey

  const response = await fetch(url, {
    method,
    signal,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let detail = null
    try {
      const payload = await response.json()
      detail = errorDetail(payload)
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new ApiError(
      detail || 'The academic service could not complete this request.',
      response.status,
    )
  }
  if (response.status === 204) return null
  return response.json()
}

const get = (path, params, signal) => requestJson(path, { params, signal })

export const getDepartments = (semester, signal) =>
  get('/departments', { semester }, signal)

export const getSubjects = (department, semester, signal) =>
  get(`/departments/${department}/subjects`, { semester }, signal)

export const getStudents = (params, signal) => get('/students', params, signal)

export const getStudent = (studentId, signal) =>
  get(`/students/${studentId}`, {}, signal)

export const getStudentResults = (studentId, semester, signal) =>
  get(`/students/${studentId}/results`, { semester }, signal)

export const getStudentComparison = (studentId, signal) =>
  get(`/students/${studentId}/comparison`, {}, signal)

export const getFailures = (params, signal) =>
  get('/results/failures', params, signal)

export const getOverview = (params, signal) =>
  get('/analytics/overview', params, signal)

export const getDepartmentComparison = (semester, signal) =>
  get('/analytics/departments', { semester }, signal)

export const getTrends = (department, signal) =>
  get('/analytics/trends', { department }, signal)

export const getSubjectAnalytics = (department, semester, signal) =>
  get('/analytics/subjects', { department, semester }, signal)

export const getHealth = (signal) => get('/health', {}, signal)

const admin = (path, key, options = {}) =>
  requestJson(path, { ...options, adminKey: key })

export const verifyAdmin = (adminKey, signal) =>
  admin('/admin/session', adminKey, { signal })

export const getAdminMeta = (department, adminKey, signal) =>
  admin('/admin/meta', adminKey, { params: { department }, signal })

export const getAdminStudents = (params, adminKey, signal) =>
  admin('/admin/students', adminKey, { params, signal })

export const previewAdminStudent = (payload, adminKey, signal) =>
  admin('/admin/students/preview', adminKey, {
    method: 'POST',
    body: payload,
    signal,
  })

export const createAdminStudent = (payload, adminKey, signal) =>
  admin('/admin/students', adminKey, { method: 'POST', body: payload, signal })

export const updateAdminStudent = (studentId, payload, adminKey, signal) =>
  admin(`/admin/students/${studentId}`, adminKey, {
    method: 'PATCH',
    body: payload,
    signal,
  })

export const deleteAdminStudent = (studentId, adminKey, signal) =>
  admin(`/admin/students/${studentId}`, adminKey, { method: 'DELETE', signal })

export const getAdminRecord = (studentId, adminKey, signal) =>
  admin(`/admin/students/${studentId}/record`, adminKey, { signal })

export const updateAdminResult = (
  studentId,
  semester,
  subjectCode,
  payload,
  adminKey,
  signal,
) =>
  admin(
    `/admin/students/${studentId}/results/${semester}/${encodeURIComponent(subjectCode)}`,
    adminKey,
    { method: 'PUT', body: payload, signal },
  )

export const getAdminBacklogs = (studentId, adminKey, signal) =>
  admin(`/admin/students/${studentId}/backlogs`, adminKey, { signal })

export const previewAdminBacklogClear = (
  studentId,
  payload,
  adminKey,
  signal,
) =>
  admin(`/admin/students/${studentId}/backlogs/preview`, adminKey, {
    method: 'POST',
    body: payload,
    signal,
  })

export const clearAdminBacklogs = (studentId, payload, adminKey, signal) =>
  admin(`/admin/students/${studentId}/backlogs/clear`, adminKey, {
    method: 'POST',
    body: payload,
    signal,
  })

export const getAdminFailures = (params, adminKey, signal) =>
  admin('/admin/failures', adminKey, { params, signal })

export const getAdminAudit = (adminKey, limit = 50, signal) =>
  admin('/admin/audit', adminKey, { params: { limit }, signal })
