# FitSync Platform Blueprint

## Platform Vision
FitSync is an end-to-end fitness marketplace that connects gym owners, trainees, trainers, product sellers, and administrators inside a single multi-sided platform. The product replaces the legacy server-rendered site with a modern React + Redux SPA powered by an Express/Mongoose API. The system covers discovery, membership management, commerce, trainer services, analytics, and monetisation with clear revenue-sharing policies across every stream.

## Core User Roles
- **Guest / Prospect**: Browses public pages (landing, Gym Explorer, marketplace). Can search for gyms, view sponsored listings, review pricing, and initiate contact flows.
- **Trainee (Member)**: Registers to manage memberships, track progress, log diet adherence, check attendance, view orders, and edit personal profile/health metrics.
- **Trainer**: Manages assigned trainees, logs attendance, progress, diet plans, submits feedback, and reviews trainee responses inside the trainer console.
- **Gym Owner**: Onboards gyms, manages listings, purchases listing subscriptions and sponsorship packages, monitors analytics (impressions, memberships, spend), and sees recent joiners.
- **Product Seller**: Maintains catalogue of fitness merchandise, tracks orders, settles payouts, and views marketplace KPIs via the seller workspace.
- **Administrator**: Oversees the entire ecosystem, including revenue analytics, user management, gym moderation, notifications, and platform configuration.

## High-Level Architecture
- **Frontend**: React SPA with React Router, Redux Toolkit (state slices + RTK Query), custom redux-form helpers, modern dashboard layouts, and responsive styling.
- **Backend**: Express API with modular controllers, Mongoose models, JWT authentication, Stripe configuration for payments, Cloudinary uploads, and middlewares for auth/error handling.
- **Datastore**: MongoDB collections for users, gyms, memberships, trainers, orders, products, revenues, listings, sponsorships, analytics, etc.
- **Static Assets**: Optimised CSS/JS bundles via Vite build, curated imagery for landing/marketing pages, admin map data using react-simple-maps.

## Feature Surface
### 1. Gym Discovery & Acquisition
- **Gym Explorer Page**: Rich search with filters (name, city, amenities) and fallback curated gyms. Sponsored gyms show highlighted badges and banners.
- **Impression Tracking**: Each gym selection triggers `/api/gyms/:id/impressions`, incrementing analytics so owners can see visibility lift from sponsorships.
- **Gym Highlight Pane**: Displays pricing, features, contact info, schedule, reviews, and sponsorship tier.

### 2. Membership & Trainer Experience
- **Trainee Dashboard**: Modules for overview, progress tracking, diet adherence, attendance history, and marketplace orders. Profile editor captures health metrics, bio, social links, and location.
- **Trainer Console**: Real-time trainee roster with filters. Forms to log attendance, record progress metrics, assign diet plans, and send structured feedback. Updates screen shows pending reviews and recent submissions.

### 3. Gym Owner Console
- **Gyms Management**: Create/edit gyms with media, amenities, pricing, and publication status.
- **Subscriptions & Sponsorships**: Purchase listing tiers, upgrade sponsorship levels, view billing cycles, and cancel/renew plans. Uses monetisation service layer with Stripe integration.
- **Analytics Dashboard**:
  - Revenue summary with weekly/monthly toggle.
  - Membership growth charts with consistent granularity controls.
  - Sponsorship exposure pie chart for active campaigns.
  - Expiring subscription table for operational alerts.
  - **Recent Joiners** list pulling last 10 memberships with profile photos and join dates.
  - Geo density map delivering location intelligence for gym coverage.

### 4. Marketplace & Seller Workflow
- **Seller Dashboard**: High-level KPIs (payouts, low-stock alerts). Inventory management with modals for CRUD, filters (published/draft/out-of-stock). Orders page enables settlement flows with RTK Query mutations.
- **Revenue Split**: When sellers settle orders, 85% of the gross order value is recorded as seller revenue and 15% as admin commission. Dual entries in `Revenue` collection guarantee transparent payouts and platform earnings.
- **Admin Commission Tracking**: Admin revenue entry uses `type: 'marketplace'` with metadata linking to order and seller payout for audit.

### 5. Administrative Suite
- **Admin Dashboard**: 
  - Overview stats for platform health (members, gyms, sellers, revenue).
  - Revenue trend chart with stream filters (Listing, Sponsorship, Marketplace), weekly/monthly toggle, and dynamic series rendering.
  - Geo Density Map with gradient legend (few/moderate/high density) for real-time location analytics.
  - Demographics summary (gender distribution, age bands) via Recharts components.
  - Marketplace table listing active sellers and product metrics.
  - Notifications panel consolidating revenue events, sponsorship activations, and operational alerts.
- **Admin Management Tools**: Delete gyms/users, adjust platform toggles (coming soon), manage notifications (archiving planned).

## Revenue Streams & Allocation
| Stream | Source | Collection Path | Allocation | Notes |
| --- | --- | --- | --- | --- |
| Listing Subscriptions | Gym owners | `GymListingSubscription`, `Revenue` | 100% Admin | Recurring monthly/annual packages controlling marketplace visibility.
| Sponsorship Campaigns | Gym owners | `Revenue`, sponsorship config on Gym model | 100% Admin | Adds promotional badge and preferential ordering in explorer.
| Marketplace Sales | Product orders | `Order`, `Revenue` | 85% Seller / 15% Admin | Settlement creates two revenue records for payout + commission.
| Trainer Services | Trainer updates and plan assignments | (Future) `TrainerRevenue` | 50% Trainer / 50% Gym Owner | Mirrors membership split: payouts trigger alongside gym owner earnings whenever trainees stay active. |
| Trainee Memberships | Gym memberships | `GymMembership`, `Revenue` | 50% Gym Owner / 50% Trainer | Membership purchases automatically log two revenue entries so both parties receive their equal share. |

## Data & Analytics
- **Revenue Collection Schema**: Captures amount, type (seller, marketplace, listing, sponsorship), user reference (null for admin commission), metadata (orderId, sellerId, plan, etc.), and timestamps.
- **Gym Analytics**: `analytics.impressions`, `analytics.lastImpressionAt`, `analytics.memberships` (future aggregate), supporting chart visuals.
- **Admin Insights Endpoint**: Aggregates gender split, age distribution, geo coverage (lat/lon with gym counts), revenue timeline, and marketplace engagement stats.
- **Trainer Activity**: Endpoints log attendance, progress metrics, diet plans, feedback records for each trainee; aggregated in trainer dashboard for follow-ups.

## Inter-Module Workflows
1. **Gym Discovery -> Membership**: Prospect views sponsored gyms (impression tracked), decides to join (future membership purchase integrates with owner revenue stats), analytics tab surfaces new joiner.
2. **Trainee Progress -> Trainer Feedback Cycle**: Trainee logs workouts/diet; trainer reviews and records attendance/feedback; updates page surfaces pending actions, ensuring continuous engagement.
3. **Seller Fulfillment -> Admin Earnings**: Seller updates inventory; customer orders create pending payouts; seller settles order -> 85% seller payout record + 15% admin commission logged simultaneously.
4. **Owner Sponsorship -> Admin Reporting**: Owner buys sponsorship, gym flagged as promoted, explorer shows badge, impressions tracked, admin map shows density change, revenue dashboard reflects sponsorship income.

## Pending Enhancements (Roadmap)
- Complete backend schema cleanup to remove legacy course-era fields and methods.
- Implement admin notification archiving + toggle management UI.
- Add subscription renewal flow and in-app notifications to trainee dashboard.
- Expand automated testing: Jest service tests, RTL for dashboards, and optional E2E coverage.
- Prune unused static assets (legacy CSS/images) post verification.

## Operational Considerations
- **Authentication**: JWT-based with refresh tokens, stored via HTTP-only cookies.
- **File Uploads**: Multer middleware with Cloudinary integration for profile pictures and gym assets.
- **Payments**: Stripe config ready for subscriptions/sponsorships; marketplace settlement can integrate payout providers.
- **Performance**: RTK Query caching and invalidation ensure efficient data fetching. Persisted auth state via redux-persist.
- **Monitoring**: `/api/system/health` endpoint available for uptime checks.

## Summary
FitSync now operates as a cohesive marketplace and service hub for the fitness vertical. Every stakeholder has a dedicated workspace, analytics are centralised for both gym owners and administrators, and the revenue model is transparent across listing subscriptions, sponsorships, and marketplace sales. The React SPA delivers role-aware dashboards with RTK Query for data integrity, while the Express backend orchestrates authentication, monetisation, file uploads, and analytics pipelines. Remaining tasks focus on legacy cleanup, admin toggles, and additional automation to polish the production release.
