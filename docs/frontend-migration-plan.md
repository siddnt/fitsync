# Frontend Migration Roadmap

_Last updated: 2025-11-05_

This plan tracks the remaining work to complete the move from server-rendered EJS pages to the React + Redux single-page application while aligning the product with the new gym marketplace domain. Each milestone lists recommended prompts/tasks you can hand to GPT (or work through manually) to keep the effort structured.

---

## Milestone A · React shell & routing parity

**Goal:** Ensure every public page currently delivered via EJS has a React route, layout, and data source.

1. **Catalogue legacy pages**
   - ✅ _Done_: Landing, gyms catalogue, marketplace, dashboards.
   - ☐ _Pending_: Profile, orders history, static info pages (about, contact), FAQ/support, login/register parity checks.
   - Prompt: “List all EJS views that still exist and indicate which React route should replace them.”

2. **Build missing React routes**
   - Create React pages/components for each outstanding public page.
   - Wire React Router navigation + header/footer links.
   - Migrate or rewrite CSS to keep color scheme.
   - Prompt: “Generate a React page for /contact with the existing styles moved from views/pages/contact.ejs.”

3. **API-first navigation**
   - Replace any remaining server redirects with SPA navigation.
   - Confirm Express only serves `/api/**` + `index.html` fallback (already in place).
   - Prompt: “Verify there are no Express routes invoking res.render and remove any orphaned route modules.”

Deliverable: Visiting any legacy URL hits the React SPA and renders equivalent content from APIs or seed data.

---

## Milestone B · Role-based dashboards & data flows

**Goal:** Lock in up-to-date experiences for trainees, trainers, gym owners, sellers, and admins within React.

1. **Trainee dashboard**
   - ✅ Overview, progress, diet, attendance, orders views.
   - ✅ Profile editor (photo, metrics, bio, social links) - universal for all roles.
   - ☐ Subscription renewal flow, in-app notifications.
   - Completed: ProfilePage.jsx with redux-form validation, backend PATCH /api/users/profile endpoint, route /profile added.

2. **Trainer console**
   - ✅ Build trainee assignment list with filtering.
   - ✅ Implement update forms (attendance, progress, diet, feedback) connected to trainer APIs.
   - Completed: TraineesPage with assignment list, UpdatesPage with four forms posting via trainerApi mutations.

3. **Gym owner console**
   - ✅ Gyms list, edit modal, subscriptions, sponsorship purchase, analytics.
   - ✅ Add impressions tracking (increment on gym view), highlight sponsored ordering on explorer.
   - ✅ Show recent joiners/members list.
   - Completed: GymExplorerPage wired with useRecordImpressionMutation; GymList shows "Sponsored" badge; GymHighlight shows sponsored banner with tier; GymOwnerDashboard shows recent 10 members with profile pictures, gym name, plan type, join date.

4. **Seller workspace**
   - ✅ API + slice scaffolding.
   - ✅ Build UI for product CRUD, order management, payout status.
   - Completed: SellerDashboard with overview analytics, InventoryPage with filter chips and CRUD modal, OrdersPage with settlement flow.

5. **Admin centre**
   - ✅ Overview analytics, revenue charts, marketplace table, delete controls.
   - ✅ Geo density map with India focus and color-coded legend, demographics charts (gender/age), notifications panel.
   - ✅ Weekly/monthly income toggle, multi-stream revenue filters (Listing/Sponsorship/Marketplace checkboxes).
   - ✅ Add toggles settings panel UI for global platform toggles, notification archiving.
   - Completed: GeoDensityMap with density legend (small/medium/large dots); AdminRevenuePage with granularity toggle (weekly/monthly), stream visibility checkboxes that filter GrowthLineChart series; GymOwnerAnalyticsPage also has weekly/monthly toggle for revenue/membership trends; AdminSettingsPage now exposes marketplace/approval/beta toggles with persistence via `/admin/settings/toggles`.

Deliverable: All role dashboards interactive, drawing data exclusively via RTK Query, with mutation flows and optimistic UI where appropriate.

---

## Milestone C · Domain clean-up & consistency

**Goal:** Remove leftover course-era assets and align models/endpoints with the gym marketplace domain.

1. **Prune legacy assets**
   - ✅ EJS templates already removed from project.
   - ✅ Course-era static assets purged; remaining CSS/images map to gyms or marketplace flows.
   - ✅ Remove old public/css files (about.css, login_register.css) if not in use by React SPA.
   - Note: All remaining global styling now lives under `client/src/styles` or component-scoped CSS modules.

2. **Audit backend schemas**
   - ✅ Legacy course fields and helpers removed from user, booking, revenue stacks.
   - ✅ No controllers reference the deprecated course enrolment flows.
   - ✅ Add MongoDB data migration notes for production backup process (optional if collections already clean).
   - Completed: `src/scripts/removeLegacyCourseFields.js` drops historical course enrolment arrays after backing up the `users` collection.

3. **Event & analytics tracking**
   - Standardise events (impressions, sponsorship activation, marketplace sales) so dashboards share metrics.
   - Prompt: “Create a shared analytics.service.js that records impressions and revenue events for reuse across controllers.”

4. **Testing & QA**
   - Expand Jest + React Testing Library coverage for the new SPA flows.
   - Add Cypress/Playwright scripts for end-to-end role flows (optional but recommended).
   - Prompt: “Write a Jest test that asserts getAdminInsights aggregates gender distribution correctly given fixture data.”

Deliverable: Repository free of obsolete course-era artifacts, models cohesive, analytics unified, and regression coverage in place.

---

## Suggested working cadence

1. Pick a milestone subsection (e.g. Milestone B.2 Trainer console).
2. Copy the relevant prompt (or craft a variant) and run it in GPT.
3. Implement generated guidance, commit, and smoke-test.
4. Update this plan (or your TODO notes) marking completed subtasks.

This roadmap should evolve—feel free to extend with new subsections as the product scope changes.
