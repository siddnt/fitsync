# End-Term Evaluation Preparation Guide

Use this guide to confidently answer your evaluator's questions. Open these files in your editor beforehand so you can quickly switch to them.

---

## Part 1: "Where is it implemented?" (Code Walkthrough)

When they ask to see a specific feature, go to these files:

### 1. UX & Navigation
*   **Question:** "Show me your navigation flow and routing."
*   **File:** `client/src/routes/AppRouter.jsx`
*   **What to say:** "We use `react-router-dom`. Here you can see our nested routes. We have public routes like `Login`, and protected routes under `DashboardLayout` which handles the sidebar navigation."

### 2. Dashboard Functionality
*   **Question:** "Show me the Login functionality."
*   **File:** `client/src/pages/auth/LoginPage.jsx`
*   **What to say:** "Here is the Login page. We use `react-hook-form` for form handling and validation, and we dispatch the `login` mutation from our Redux API slice."
*   **Question:** "Where is the Stock Entry / Inventory management?"
*   **File:** `client/src/pages/dashboards/seller/InventoryPage.jsx`
*   **What to say:** "This is the Inventory page where sellers can add and manage products. It fetches data using `useGetSellerProductsQuery` and allows editing stock levels."
*   **Question:** "Show me Report Generation / Analytics."
*   **File:** `client/src/pages/dashboards/SellerDashboard.jsx` (or `AdminRevenuePage.jsx`)
*   **What to say:** "In the Seller Dashboard, we calculate metrics like 'Delivered Orders Value' and 'In-progress Volume' using `useMemo` to aggregate data from the orders array efficiently."

### 3. React Implementation
*   **Question:** "Show me a Functional Component."
*   **File:** `client/src/pages/dashboards/SellerDashboard.jsx`
*   **What to say:** "This `SellerDashboard` is a functional component. It receives props (if any), uses hooks for state, and returns JSX for the UI."
*   **Question:** "Where did you use `useState` and `useEffect`?"
*   **File:** `client/src/pages/auth/LoginPage.jsx`
*   **What to say:**
    *   **useEffect:** (Line 30) "We use `useEffect` here to automatically redirect the user if they are already logged in."
    *   **useState:** (Note: You mostly use Redux/Form hooks, but you can point to `client/src/pages/dashboards/seller/InventoryPage.jsx` which likely uses local state for modals or filters).

### 4. Redux Integration
*   **Question:** "Show me your Redux Store configuration."
*   **File:** `client/src/app/store.js`
*   **What to say:** "This is our central store. We use `configureStore` from Redux Toolkit. We also use `redux-persist` (Line 28) to save the user's session in local storage so they stay logged in on refresh."
*   **Question:** "Show me a Slice."
*   **File:** `client/src/features/auth/authSlice.js`
*   **What to say:** "This is the Auth Slice. It manages the user's authentication state (user object, token, loading status). It handles actions like `authSuccess` and `signOut`."

---

## Part 2: Viva Voce Q&A (The "Why" and "What")

### React Questions

**Q: Why did you use React?**
*   **Answer:** "We chose React for three main reasons:
    1.  **Component-Based:** It allows us to build reusable UI pieces (like our `DashboardSection` or `StatCard`) and compose them into complex pages.
    2.  **Virtual DOM:** It's fast. React only updates the parts of the page that change, rather than reloading the whole page.
    3.  **Ecosystem:** It has great libraries like `react-router` for navigation and Redux for state management."

**Q: What is the difference between `useState` and `useEffect`?**
*   **Answer:**
    *   `useState` is for **memory**. It lets a component "remember" things, like user input or whether a modal is open. When state changes, the component re-renders.
    *   `useEffect` is for **side effects**. It lets us run code *after* the render, like fetching data, subscribing to events, or manually changing the DOM (e.g., changing the page title).

**Q: What is the Context API and where did you use it?**
*   **Answer:** "Context provides a way to pass data through the component tree without having to pass props down manually at every level. While we primarily use Redux for global state, libraries we use like `react-router` (for navigation) and `react-redux` (the `<Provider>` in `main.jsx`) use Context internally to make their features available everywhere."

### Redux Questions

**Q: Why did you use Redux? Why not just `useState`?**
*   **Answer:** "For a complex app like this, `useState` leads to 'Prop Drilling'—passing data down through 10 layers of components. Redux gives us a **Global Store**. Any component, anywhere in the app, can access the user's data or cart items directly from the store without messy prop chains."

**Q: What is a 'Slice' in Redux?**
*   **Answer:** "A Slice is a collection of Redux logic for a single feature. For example, our `authSlice.js` contains the **Initial State** (is the user logged in?), the **Reducers** (functions to change that state), and the **Actions** (names of those events) all in one file. It makes the code much more organized than old-school Redux."

**Q: Explain `createApi` / RTK Query (in `apiSlice.js`).**
*   **Answer:** "Instead of manually writing `fetch` calls and handling `loading`, `success`, and `error` states in every component, we use RTK Query. It automatically manages fetching data, caching it (so we don't re-fetch unnecessarily), and gives us simple hooks like `useGetSellerProductsQuery` that we can just use in our components."

### General Questions

**Q: How did you ensure Team Cohesion?**
*   **Answer:** "We divided the work by modules. One person handled the Auth & Backend, another worked on the Trainer Dashboard, and another on the Seller features. We used Git for version control to merge our work without conflicts."

**Q: How did you handle Git usage?**
*   **Answer:** "We used feature branches (like `pushpCodes`, `sidcodes`) to work on features in isolation. We wrote meaningful commit messages to track our progress and merged changes via Pull Requests."
