# Redis Cache Benchmark

Generated: 2026-04-19T16:28:44.636Z

Cache provider during benchmark: redis

| Endpoint | Avg without cache (ms) | Avg cached (ms) | Improvement |
| --- | ---: | ---: | ---: |
| Gym catalogue | 49.33 | 11.62 | 76.44% |
| Marketplace catalogue | 23.44 | 9.82 | 58.11% |

Notes:
- Warm runs were executed after a single priming request.
- Use `X-Cache: HIT` and `X-Cache-Provider` headers during review to demonstrate cache behaviour live.