# Benchmark Results

Generated 2026-10-31T08:04:42.850150+00:00

## Operation

Student pass/fail aggregation for one department and one semester (100 students, 500 subject rows in Cassandra).

Both outputs are verified to match before timing. The Mongo side reads pre-aggregated
student summaries; the Cassandra side reads 500 subject rows and groups them by student.
This reflects the intended access patterns, not an engine-only synthetic workload.

## Environment

| Item | Value |
| --- | --- |
| Label | local MongoDB + local Cassandra (development validation) |
| Platform | Windows-11-10.0.26200-SP0 |
| Python | 3.13.2 |
| MongoDB network | loopback |
| Cassandra network | loopback |
| Samples | 600 (30 iterations x 20 department-semesters) |

**Topology note:** MongoDB and Cassandra were both measured locally in this run. The MongoDB operation reads pre-aggregated summaries; the Cassandra operation reads and groups subject rows. These are different data models and access patterns, not an engine-only comparison.

## Results

| System | Median | p95 | Min | Max |
| --- | ---: | ---: | ---: | ---: |
| MongoDB | 5.299 ms | 11.354 ms | 2.446 ms | 35.97 ms |
| Cassandra | 30.409 ms | 59.563 ms | 12.108 ms | 629.024 ms |

Cassandra median / MongoDB median: **5.74x** (lower means Cassandra was faster in this topology).

These figures should be read as end-to-end execution times for different data models and
network paths. They do not establish that one engine is faster in general.
