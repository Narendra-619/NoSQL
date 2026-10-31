export function gradeFor(total, gradeBands) {
  const sorted = [...(gradeBands || [])].sort((a, b) => b.min_marks - a.min_marks)
  return (
    sorted.find((band) => total >= band.min_marks) || {
      min_marks: 0,
      grade: 'F',
      points: 0,
    }
  )
}

function parseMark(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

export function evaluateResult(internalValue, externalValue, subject, gradeBands) {
  const internal = parseMark(internalValue)
  const external = parseMark(externalValue)
  const valid =
    internal !== null &&
    external !== null &&
    internal >= 0 &&
    internal <= (subject.internal_max ?? 30) &&
    external >= 0 &&
    external <= (subject.external_max ?? 70)
  if (!valid) {
    return {
      valid: false,
      internal,
      external,
      total: null,
      grade: null,
      points: null,
      passed: null,
      status: null,
    }
  }
  const total = internal + external
  const band = gradeFor(total, gradeBands)
  const passed = total >= (subject.pass_marks ?? 40)
  return {
    valid: true,
    internal,
    external,
    total,
    grade: band.grade,
    points: band.points,
    passed,
    status: passed ? 'PASS' : 'FAIL',
  }
}

export function semesterStats(subjects, marks, gradeBands) {
  const outcomes = subjects.map((subject) => {
    const values = marks[subject.code] || {}
    return {
      subject,
      result: evaluateResult(values.internal, values.external, subject, gradeBands),
    }
  })
  if (outcomes.some((item) => !item.result.valid)) return null
  const credits = outcomes.reduce((sum, item) => sum + item.subject.credits, 0)
  const points = outcomes.reduce(
    (sum, item) => sum + item.subject.credits * item.result.points,
    0,
  )
  const failed = outcomes.filter((item) => item.result.status === 'FAIL')
  return {
    sgpa: credits ? Number((points / credits).toFixed(2)) : 0,
    credits,
    earned: outcomes
      .filter((item) => item.result.status === 'PASS')
      .reduce((sum, item) => sum + item.subject.credits, 0),
    failedCount: failed.length,
    status: failed.length ? 'FAIL' : 'PASS',
  }
}
