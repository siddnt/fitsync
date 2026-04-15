# Load Test Report

Generated: 2026-04-14T20:45:15.062Z

Duration per scenario: 8s
Connections: 20
Pipelining: 1

| Scenario | Avg req/s | p95 req/s | Avg latency (ms) | p95 latency (ms) | Non-2xx | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Gym catalogue uncached | 33.13 | 44 | 597.31 | 1088.67 | 0 | 0 |
| Gym catalogue cached | 665 | 840 | 29.84 | 36.67 | 0 | 0 |
| Marketplace catalogue uncached | 36.5 | 42 | 495.47 | 977.33 | 0 | 0 |
| Marketplace catalogue cached | 875 | 1059 | 22.42 | 40.33 | 0 | 0 |

| Comparison | Avg latency improvement | Throughput gain |
| --- | ---: | ---: |
| Gym catalogue | 95% | 1907.24% |
| Marketplace catalogue | 95.48% | 2297.26% |

Notes:
- Uncached scenarios send `X-Cache-Mode: bypass` to measure raw backend path performance.
- Cached scenarios reuse the same public endpoints without bypass headers.
- Use this report together with `docs/redis-cache-report.md` and `docs/query-plan-report.md` during review.