# FitSync

Full-stack gym and marketplace platform with an Express/MongoDB API, Redis-backed caching, OpenAPI/Swagger docs, and a Vite + React client.

## What you get
- Member, trainer, seller, and owner consoles for memberships, listings, inventory, orders, and analytics.
- Stripe-ready payments, image uploads, and JWT-based auth with refresh tokens.
- Indexed gym and marketplace search with Redis-backed caching for public catalogue reads.
- React + Redux Toolkit front-end with Vite dev server and API proxying.

## Project layout
- API server: `src/` (Express + MongoDB)
- Web client: `client/` (Vite + React)

## Prerequisites
- Node.js 18+
- npm
- MongoDB running locally or remotely (set `MONGODB_URI`)
- Redis for cache-backed development, benchmarking, and review demos (set `REDIS_URL`)

## Setup
1. Install server deps from the repository root:
```bash
npm install
```

2. Install client deps:
```bash
cd client
npm install
cd ..
```

3. Environment files:
- Server: create `.env` in the repo root. Minimal local config:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/fitsync
REDIS_URL=redis://localhost:6379
REDIS_DEFAULT_TTL_SECONDS=120
MEMORY_CACHE_MAX_ENTRIES=500
GYM_IMPRESSION_FLUSH_INTERVAL_MS=15000
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=fitsync-meili-key
SEARCH_BOOTSTRAP_ON_STARTUP=true
SEARCH_SYNC_FLUSH_INTERVAL_MS=1000
SEARCH_SYNC_MAX_QUEUE_ITEMS=1000
SEARCH_SYNC_QUEUE_NAME=fitsync-search-sync
OUTBOX_BATCH_SIZE=25
OUTBOX_POLL_INTERVAL_MS=3000
OUTBOX_RETRY_DELAY_MS=15000
SLOW_QUERY_THRESHOLD_MS=75
MAX_SLOW_QUERY_SAMPLES=25
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=5
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_SOCKET_TIMEOUT_MS=45000
CORS_ORIGIN=http://localhost:5173,http://localhost:4000
JWT_SECRET=dev-jwt-secret
REFRESH_TOKEN_SECRET=dev-refresh-secret
STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
CLOUDINARY_URL=
```
- You can start from the committed `.env.example`.
- Client: copy `client/.env.example` to `client/.env` and adjust as needed. By default the client proxies `/api` to `http://localhost:4000`.
- Runtime env loading is profile-specific:
  - app/server entrypoints load `.env.local` then `.env`
  - tests load `.env.test.local` then `.env.test` and never fall back to `.env`
  - review/report scripts load `.env.report.local`, `.env.report`, `.env.ops.local`, or `.env.ops` and never fall back to `.env`
- Use `.env.test.example` and `.env.report.example` as the starting points for isolated test and review runs.

## Run in development
Open two terminals:

1. Start the API server:
```bash
npm run dev
```

2. Start the Vite client:
```bash
npm run client:dev
```

Default local URLs:
- API: `http://localhost:4000`
- Web client: `http://localhost:5173`
- Swagger UI: `http://localhost:4000/api/docs`

## Admin quick start
Create an admin user:

```bash
./create-admin.sh
# or
node src/scripts/createAdminUser.js
```

## Scripts
- `npm run dev` - API dev server with nodemon
- `npm start` - API production start
- `npm test` - backend tests with Jest
- `npm run test:report` - Jest coverage plus JSON report output under `reports/jest`
- `npm run client:dev` - client dev server
- `npm run client:build` - client production build
- `npm run client:preview` - preview the built client locally
- `npm run review:stack:up` - start the local MongoDB, Redis, and Meilisearch services used for review evidence
- `npm run review:stack:down` - stop the local MongoDB, Redis, and Meilisearch review services
- `npm run db:analyze` - generate MongoDB query-plan reports in `docs/` using the isolated report env profile
- `npm run cache:benchmark` - benchmark cached vs uncached public endpoints with a live Redis connection and write the Redis report to `docs/`
- `npm run load:test` - run sustained HTTP load against public catalogue endpoints and write latency/throughput reports to `docs/`
- `npm run search:sync` - rebuild the Meilisearch gym and marketplace indexes from MongoDB

## API docs
- OpenAPI JSON: `GET /api/docs/openapi.json`
- Swagger UI: `GET /api/docs`
- Prometheus metrics: `GET /api/system/metrics/prometheus`
- Authenticated routes use `Authorization: Bearer <token>`
- Refresh-token flows also support the `refreshToken` cookie

## DB optimization and cache evidence
- MongoDB compound indexes and text indexes are defined on the public gym, marketplace, and order collections.
- Public catalogue and detail reads use Redis-backed response caching with automatic in-process fallback if Redis is unavailable.
- The in-process fallback is bounded by `MEMORY_CACHE_MAX_ENTRIES` and coalesces concurrent misses for the same key to avoid stampedes.
- Marketplace product cards now read denormalized sales/review metrics from `Product.metrics` instead of aggregating orders and reviews on each cache miss.
- Gym catalogue responses now read denormalized review, membership, and trainer counters from `Gym.analytics`.
- Gym impressions are buffered and flushed in batches using `GYM_IMPRESSION_FLUSH_INTERVAL_MS` to reduce write amplification and cache churn.
- Search index updates are queued through BullMQ on Redis, with automatic in-memory fallback if Redis is unavailable. `SEARCH_SYNC_FLUSH_INTERVAL_MS` controls the fallback flush loop and `SEARCH_SYNC_QUEUE_NAME` names the Redis queue.
- Critical gym listing and marketplace fulfillment writes now use Mongo sessions plus an outbox worker so cache/search side effects run after the database commit.
- Public catalogue endpoints use stale-while-revalidate response caching, conditional `ETag`/`Last-Modified` handling, and HTTP compression.
- Search fallback is backed by Meilisearch instead of regex scanning when Mongo text search yields no matches.
- Public gym and marketplace browse endpoints also support cursor pagination via `pagination=cursor` and `cursor=<token>` to avoid large MongoDB skips.
- Seller products, seller orders, and owner trainer-request queues also support cursor pagination.
- Runtime metrics for cache states, slow queries, search requests, search queue depth, and route latencies are exposed at `GET /api/system/metrics`.
- Prometheus-compatible plaintext metrics are exposed at `GET /api/system/metrics/prometheus`.
- Cache behaviour is visible through `X-Cache` and `X-Cache-Provider` response headers.
- `npm run db:analyze` writes `docs/query-plan-report.json` and `docs/query-plan-report.md`.
- `npm run cache:benchmark` now requires `getCacheStatus().provider === 'redis'` and exits non-zero instead of producing a misleading memory-backed report.
- `npm run cache:benchmark` writes `docs/redis-cache-report.json` and `docs/redis-cache-report.md` only when Redis is actually connected.
- `npm run load:test` writes `docs/load-test-report.json` and `docs/load-test-report.md`.

## Build for production
1. Build the client assets:
```bash
npm run client:build
```

2. Serve the API with `npm start` and host `client/dist` behind your web server or CDN.

## Docker
The repository now includes:
- `Dockerfile` for the API image
- `client/Dockerfile` for the frontend image
- `client/nginx.conf` for SPA serving and reverse proxying
- `docker-compose.yml` for the full local stack

The compose stack runs:
- `mongo`
- `redis`
- `meilisearch`
- `api` on `http://localhost:4000`
- `web` on `http://localhost:8080`
- optional `prometheus` on `http://localhost:9090` and `grafana` on `http://localhost:3001` via `--profile monitoring`

Build and start the stack:

```bash
docker compose up --build
```

Start the monitoring profile:

```bash
docker compose --profile monitoring up -d prometheus grafana
```

Stop it:

```bash
docker compose down
```

Notes:
- the web container proxies `/api`, `/uploads`, and `/payments` to the API container
- the API container connects to Redis through `REDIS_URL=redis://redis:6379`
- the API container connects to Meilisearch through `MEILISEARCH_HOST=http://meilisearch:7700`
- uploaded files and request logs are stored in Docker volumes
- you can override compose defaults with shell environment variables or a local `.env`
- for a local end-review evidence run, `npm run review:stack:up` is the shortest way to start just MongoDB, Redis, and Meilisearch

## Deployment Evidence
- Record the final hosted frontend URL, API URL, Swagger URL, and health URL in `docs/deployment-evidence.md` before the review demo.
- This repository includes the Docker assets needed to publish the API and web client on a managed host or VM.
- The deployment evidence file is intentionally committed as a checklist/template so the final hosted URLs are review-ready instead of living only in chat or local notes.

## GitHub Actions
The repository now includes `.github/workflows/ci.yml`.

The workflow:
- installs root and client dependencies
- starts MongoDB and Redis service containers
- starts Meilisearch for external search
- runs backend tests with coverage and JSON reports
- builds the Vite client
- generates query-plan and cache benchmark artifacts
- builds the API and client Docker images

## Jenkins
The repository now includes a `Jenkinsfile`.

By default, the pipeline:
- checks out the branch
- installs root and client dependencies with `npm ci`
- starts MongoDB with Docker Compose
- runs backend tests
- builds the client
- builds the API and web Docker images

Optional pipeline parameters let you:
- push images to a registry
- deploy the full stack locally on the Jenkins agent with Docker Compose

For Jenkins to run this pipeline, the agent needs:
- Node.js 20+
- Docker with Compose support
- network access to pull npm packages and Docker base images

If you enable image pushing, configure a Jenkins username/password credential and pass its ID through `DOCKER_CREDENTIALS_ID`.

For local Jenkins on this machine, the repository also includes an optional Dockerized controller profile in `docker-compose.yml`. Start it with:

```bash
docker compose --profile jenkins up -d --build jenkins
```

Local Jenkins URL:
- `http://localhost:8081`

Default local credentials created by the init script:
- username: `admin`
- password: `admin123!`

The local controller auto-creates a pipeline job named `fitsync` that reads the repository `Jenkinsfile`.

## Quick tour
- API: Express routes under `src/api`, Mongo connection in `src/db`, auth/session handling in `src/middlewares` and `src/models`
- Client: pages and dashboards in `client/src/pages`, API calls via RTK Query services in `client/src/services`, and global state in `client/src/features`
