# FitSync

Full-stack gym and marketplace platform with an Express/MongoDB API and a Vite + React client.

## What you get

- Member, trainer, seller, and owner consoles for memberships, listings, inventory, orders, and analytics.
- Stripe-ready card payments, project UPI checkout (QR/link + manual confirm), image uploads, and JWT-based auth with refresh tokens.
- React + Redux Toolkit front-end with Vite dev server and API proxying.

## Project layout

- API server: `src/` (Express + MongoDB)
- Web client: `client/` (Vite + React)

## Prerequisites

- Node.js 18+
- npm
- MongoDB running locally or remotely (set `MONGODB_URI`)

## Setup

1. Install server deps (root):

```
npm install
```

2. Install client deps:

```
cd client
npm install
cd ..
```

3. Environment files:

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
UPI_DUMMY_MODE=true
DEMO_UPI_ID=fitsync.demo@upi
DEMO_UPI_NAME=FitSync Demo
COD_MAX_ORDER_AMOUNT=2500
COD_ALLOWED_PINCODES=560001,110001,400001
COD_FEE=49
COD_CONFIRMATION_MINUTES=30
COD_AUTO_CANCEL_ENABLED=true
COD_AUTO_CANCEL_INTERVAL_MS=60000
CLIENT_BASE_URL=http://localhost:5173
CLOUDINARY_URL= # or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET
```

- Client: copy `.env.example` inside `client/` to `.env` and adjust as needed (default proxies `/api` to `http://localhost:4000`).

## Run in development

Open two terminals:

1. API server (nodemon):

```
npm run dev
```

Starts at `http://localhost:4000`.

2. Web client (Vite + HMR):

```
npm run client:dev
```

Serves at `http://localhost:5173` and proxies `/api` to the server.

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
- `npm run client:dev` — client dev server
- `npm run client:build` — client production build
- `npm run client:preview` — preview built client locally

## Build for production

1. Build client assets:

```
npm run client:build
```

2. Serve API with `npm start` and host the built client (`client/dist`) behind your chosen web server or CDN.

## Quick tour

- API: Express routes under `src/api`, Mongo connection in `src/db`, auth/session handling in `src/middlewares` and `src/models`.
- Client: pages and dashboards in `client/src/pages`, API calls via RTK Query services in `client/src/services`, global state in `client/src/features` and `client/src/app/store.js`.

## API documentation

- Swagger UI: `http://localhost:4000/api/docs`
- Raw OpenAPI JSON: `http://localhost:4000/api/docs.json`
- The documentation covers the current FitSync web services for auth, gyms, dashboards, trainer workflows, owner/admin operations, marketplace flows, and payments.

## Stripe flow

- Gym owner listing subscriptions and sponsorship purchases now use Stripe Checkout via:
  - `POST /api/payments/owner/subscriptions/checkout-session`
  - `POST /api/payments/owner/sponsorships/checkout-session`
  - `POST /api/payments/owner/confirm`
  - `POST /api/payments/webhook`
- Redirect targets for Stripe success/cancel are generated from `CLIENT_BASE_URL` (fallbacks to `CORS_ORIGIN` or `APP_BASE_URL`).

## Marketplace UPI flow

- Checkout page generates a UPI QR/link and confirms payment manually via:
  - `POST /api/payments/marketplace/upi/session`
  - `POST /api/payments/marketplace/upi/confirm`
- Configure demo UPI details in root `.env`:
  - `UPI_DUMMY_MODE=true`
  - `DEMO_UPI_ID`
  - `DEMO_UPI_NAME`

## Marketplace COD rules

- COD can be restricted by:
  - max amount (`COD_MAX_ORDER_AMOUNT`)
  - allowed PIN codes (`COD_ALLOWED_PINCODES`)
  - additional COD fee (`COD_FEE`)
- COD orders now require customer confirmation and unconfirmed orders are auto-canceled by a background sweep:
  - confirmation window: `COD_CONFIRMATION_MINUTES`
  - sweep enable/interval: `COD_AUTO_CANCEL_ENABLED`, `COD_AUTO_CANCEL_INTERVAL_MS`
- COD confirmation endpoint:
  - `POST /api/marketplace/orders/:orderId/cod-confirm`
