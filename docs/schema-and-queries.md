# Schema And Queries

## MongoDB

Database: `academic_system`

| Collection | Purpose | Key / indexes |
| --- | --- | --- |
| `students` | Identity and academic status | `_id` UUID string, unique `roll_number`, `(department_code, roll_number)` |
| `departments` | Department catalog | `_id` / `code` |
| `subjects` | Semester subject catalog | `_id` / `code`, `(department_code, semester, code)` |
| `student_semester_summaries` | Dashboard-ready derived performance | unique `(student_id, semester)`, `(semester, department_code, roll_number)`, `(semester, department_code, cgpa, backlog_count, result_status)`, `(semester, cgpa, backlog_count, result_status)` |
| `app_metadata` | Seed version, counts, source version | `_id` |

Collections are created with strict JSON Schema validators. The seed uses upserts so
rerunning it does not duplicate records.

### Register query

The student register filters and sorts on the summary collection, then merges identity
fields from `students`:

```javascript
db.student_semester_summaries.aggregate([
  { $match: {
      semester: 4,
      department_code: "CSE",
      cgpa: { $gte: 8.0 },
      backlog_count: 0,
      result_status: "PASS"
  } },
  { $sort: { cgpa: -1, roll_number: 1 } },
  { $facet: {
      metadata: [{ $count: "total" }],
      items: [{ $skip: 0 }, { $limit: 25 }]
  } }
])
```

The compound indexes lead with `semester`, matching the dashboard's semester scope.
Sorting by roll number is covered by `semester_department_roll`; CGPA ordering is covered
by the CGPA indexes.

### Overview query

```javascript
db.student_semester_summaries.aggregate([
  { $match: { semester: 4, department_code: "CSE" } },
  { $group: {
      _id: null,
      student_count: { $sum: 1 },
      pass_count: { $sum: { $cond: [{ $eq: ["$result_status", "PASS"] }, 1, 0] } },
      average_cgpa: { $avg: "$cgpa" },
      students_with_backlogs: { $sum: { $cond: [{ $gt: ["$backlog_count", 0] }, 1, 0] } },
      average_backlogs: { $avg: "$backlog_count" }
  } }
])
```

Fail count is computed as `student_count - pass_count`; an exact joined count is not stored.

## Cassandra

Keyspace: `academic_system`. Replication:
`{'class': 'SimpleStrategy', 'replication_factor': 1}`. This is single-node development
configuration only; production would use a replicated network topology.

### Student history

```sql
CREATE TABLE results_by_student_semester (
    student_id uuid,
    semester int,
    subject_code text,
    subject_name text,
    department_code text,
    roll_number text,
    academic_year text,
    credits int,
    internal_marks int,
    external_marks int,
    total_marks int,
    grade text,
    grade_points double,
    result_status text,
    PRIMARY KEY ((student_id), semester, subject_code)
) WITH CLUSTERING ORDER BY (semester ASC, subject_code ASC);
```

Queries:

```sql
SELECT ... FROM results_by_student_semester WHERE student_id = ?;
SELECT ... FROM results_by_student_semester WHERE student_id = ? AND semester = ?;
```

The full partition is bounded by one student's 20 subject rows in this dataset.

### Department and subject views

```sql
CREATE TABLE results_by_department_semester (
    department_code text,
    semester int,
    subject_code text,
    result_status text,
    roll_number text,
    student_id uuid,
    student_name text,
    subject_name text,
    academic_year text,
    credits int,
    internal_marks int,
    external_marks int,
    total_marks int,
    grade text,
    grade_points double,
    PRIMARY KEY ((department_code, semester), subject_code, result_status, roll_number)
) WITH CLUSTERING ORDER BY (subject_code ASC, result_status ASC, roll_number ASC);
```

Queries:

```sql
SELECT ... FROM results_by_department_semester
WHERE department_code = ? AND semester = ?;

SELECT ... FROM results_by_department_semester
WHERE department_code = ? AND semester = ? AND subject_code = ?;

SELECT ... FROM results_by_department_semester
WHERE department_code = ? AND semester = ? AND subject_code = ?
  AND result_status = 'FAIL';
```

The second and third predicates follow the clustering order. Every query includes the full
partition key; the application does not use `ALLOW FILTERING`.

The row-level denormalisation duplicates identity fields into result rows. That is
intentional: department and failure views are read without a cross-database join.

Writes go through admin operations: the seed, single-result correction, and backlog
clearance. Because `result_status` is part of the department-table clustering key, changing
a failed result to passing requires deleting the old `FAIL` row and inserting the new
`PASS` row. The student-table row uses `(student_id, semester, subject_code)` and can be
overwritten by upsert. After the Cassandra writes, all four MongoDB summaries are
recomputed. Cassandra does not participate in a distributed transaction, so a write failure
triggers a best-effort rollback to the previous rows.

### Why two result tables

- Student profile reads are one partition read.
- Department/subject/failure scans group within a single `(department_code, semester)`
  partition.
- Cassandra has no general-purpose aggregation comparable to MongoDB's pipeline; the
  department analytics are computed over one bounded partition in the service layer.

Cassandra does not calculate CGPA or semester summaries. Those are derived once during
seed and materialised in MongoDB, which keeps both dashboards' aggregate reads bounded and
predictable.

## Cross-store consistency

- Student IDs are `uuid5(NAMESPACE_URL, "https://cit.example/students/{roll_number}")`.
- Both stores use the same roll number, department code, subject code, credits, marks, and
  result status from one deterministic generation pass.
- `scripts/verify_data.py` compares counts and sample identities across both stores.
- Integration tests verify that the Cassandra failure list matches the API's failure
  endpoint and that summary-based analytics divide cleanly into pass/fail counts.

There is intentionally no distributed transaction. If identity and results are ever
written outside the seed, a repair/reconciliation job would be required.
