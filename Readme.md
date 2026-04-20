# FitSync

Full-stack gym and marketplace platform with an Express/MongoDB API and a Vite + React client.

## What you get
- Member, trainer, seller, and owner consoles for memberships, listings, inventory, orders, and analytics.
- Stripe-ready payments, image uploads, and JWT-based auth with refresh tokens.
- React + Redux Toolkit front-end with Vite dev server and API proxying.

## Project layout
- API server: `src/` (Express + MongoDB)
- Web client: `client/` (Vite + React)

## Prerequisites
- Node.js 18+
- npm
- MongoDB running locally or remotely (set `MONGODB_URI`)

## Setup
1) Install server deps (root):
```
npm install
```

2) Install client deps:
```
cd client
npm install
cd ..
```

3) Environment files:
- Server: create `.env` in the repo root. Minimal for local dev:
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/fitsync
CORS_ORIGIN=http://localhost:5173,http://localhost:4000
JWT_SECRET=dev-jwt-secret
REFRESH_TOKEN_SECRET=dev-refresh-secret
STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
SOLR_URL=http://localhost:8983/solr/fitsync
CLOUDINARY_URL= # or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET
```
- Client: copy `.env.example` inside `client/` to `.env` and adjust as needed (default proxies `/api` to `http://localhost:4000`).

## Run in development
Open two terminals:
1) API server (nodemon):
```
npm run dev
```
Starts at `http://localhost:4000`.

2) Web client (Vite + HMR):
```
npm run client:dev
```
Serves at `http://localhost:5173` and proxies `/api` to the server.

## Client install note
If the client fails on Windows with a Rollup native module error such as `@rollup/rollup-win32-x64-msvc`, reinstall the client dependencies:
```
Remove-Item -Recurse -Force client/node_modules
npm install --prefix client
```
Then start the client again with `npm run client:dev`.

## API documentation
- Swagger UI: `http://localhost:4000/api/docs`
- Raw OpenAPI JSON: `http://localhost:4000/api/docs.json`

## Admin quick start
- Create an admin user:
```
./create-admin.sh
# or
node src/scripts/createAdminUser.js
```
- Login at `http://localhost:4000/auth/login` with the generated `admin@fitsync.com / admin123`.

## Scripts
- `npm run dev` — API dev server with nodemon
- `npm start` — API production start
- `npm test` — backend tests (Jest)
- `npm run benchmark` — role-aware Redis benchmark across cache-enabled endpoints
- `npm run reindex:solr` — rebuild Solr search index from MongoDB
- `npm run client:dev` — client dev server
- `npm run client:build` — client production build
- `npm run client:preview` — preview built client locally

## Build for production
1) Build client assets:
```
npm run client:build
```
2) Serve API with `npm start` and host the built client (`client/dist`) behind your chosen web server or CDN.

## Quick tour
- API: Express routes under `src/api`, Mongo connection in `src/db`, auth/session handling in `src/middlewares` and `src/models`.
- Client: pages and dashboards in `client/src/pages`, API calls via RTK Query services in `client/src/services`, global state in `client/src/features` and `client/src/app/store.js`.


