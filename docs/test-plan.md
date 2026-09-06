# Comprehensive Verification & Test Plan: Personal Gemini Journal

Every user-facing interaction, error state, and backend boundary has a corresponding test procedure below.

---

### Test Suite 1: Authentication & Landing View
- **TC-1.1: Landing View Presentation**:
  - **Given**: An unauthenticated visitor navigates to the root URL `/`.
  - **When**: The page loads.
  - **Then**: Display the Bento Grid landing layout, product value proposition, one-line privacy assurance (*"Your journals remain strictly isolated to your account; AI API keys never reach the browser"*), and the "Continue with Google" primary action button.
- **TC-1.2: Google Sign-In**:
  - **Given**: Visitor clicks "Continue with Google".
  - **When**: Google OAuth popup opens and user approves account selection.
  - **Then**: Firebase Auth initializes the user profile, sets the ID token, and automatically redirects into the Private Reflection Dashboard.
- **TC-1.3: Unauthenticated Protected Route Access**:
  - **Given**: An unauthenticated user or script calls `GET /v1/sessions` without an Authorization header.
  - **Then**: Server returns `401 Unauthorized` with `{ error: "Unauthorized: Missing or malformed Authorization header with Bearer token." }`.

---

### Test Suite 2: Private Dashboard & Session Lifecycle
- **TC-2.1: Empty State Display**:
  - **Given**: A newly registered user arrives on the dashboard.
  - **Then**: Show welcoming text with user's name, zero sessions in history, an inviting empty state card, and prominent "New Journal Session" button.
- **TC-2.2: Create Journal Session**:
  - **Given**: User clicks "New Journal Session".
  - **When**: User provides optional title (e.g., "Sprint 34 Reflections") and tags (e.g., "engineering, focus").
  - **Then**: Backend issues `POST /v1/sessions`, initializes document with server timestamps, `schemaVersion: 1`, and redirects user directly into the active conversation view.
- **TC-2.3: Session Filtering**:
  - **Given**: User has multiple past sessions with various tags and dates.
  - **When**: User selects date range filter or filters by tag.
  - **Then**: Session list updates to show only matching entries; clearing filter restores full history.

---

### Test Suite 3: Multi-turn Conversation & AI Reflections
- **TC-3.1: Send Reflection Message**:
  - **Given**: User is in an active session view.
  - **When**: User types a reflection (e.g., "I felt overwhelmed today by competing priorities...") and clicks "Send Reflection" or presses Enter.
  - **Then**:
    1. Input area enters loading state with animated indicator.
    2. Backend validates message length (1-8,000 chars), appends user turn, invokes Gemini with resilient fallback, appends model reply, and returns both with server-assigned sequence numbers.
    3. UI renders user message and Gemini reflection with formatted markdown.
- **TC-3.2: Input Boundary Enforcement**:
  - **Given**: User attempts to submit an empty or whitespace-only message.
  - **Then**: Submit button remains disabled without sending a network call.
- **TC-3.3: Transient Provider Error & Retry**:
  - **Given**: Gemini API simulates a transient failure (429 or 503).
  - **Then**: The backend fallback ladder tries secondary models. If all fail, the UI displays a non-destructive error banner with a "Retry Reflection" button; the user's drafted message is preserved in the input box.

---

### Test Suite 4: Session Summarization
- **TC-4.1: Automated Structured Summary Generation**:
  - **Given**: A session with at least one exchange.
  - **When**: User clicks "Generate Summary".
  - **Then**: Backend calls `POST /v1/sessions/:id/summarize`, Gemini parses the dialogue into a structured summary (headline, core themes, key takeaways, actionable horizon), validates via Zod, persists to Firestore, and displays the summary card prominently in the session view.

---

### Test Suite 5: Reflection Compass Synthesis
- **TC-5.1: Compass Report Generation**:
  - **Given**: User navigates to the Reflection Compass view.
  - **When**: User clicks "Generate Reflection Compass" for a chosen period.
  - **Then**: Backend aggregates all sessions in range, calls Gemini to synthesize cross-session growth patterns, and returns a structured report featuring core synthesis, overarching themes, progress highlights, challenges, prioritized next steps, and reflection prompts.

---

### Test Suite 6: Trusted People & Access Management
- **TC-6.1: Add Trusted Person**:
  - **Given**: User navigates to the "Trusted People" tab.
  - **When**: User enters an email (e.g., `mentor@example.com`), optional name (`"Alice Mentor"`), and clicks "Add Trusted Person".
  - **Then**:
    1. Input validation confirms valid email format.
    2. Backend calls `POST /v1/trusted-people` and stores contact under `/users/{uid}/trustedPeople`.
    3. List refreshes showing active trusted person with initial status badge.
- **TC-6.2: Revoke Trusted Person**:
  - **Given**: User has an existing trusted person.
  - **When**: User clicks "Revoke Access" and confirms.
  - **Then**: Backend calls `DELETE /v1/trusted-people/:id`, sets status to `revoked`, and automatically revokes all associated share grants so the contact can no longer view shared reports.

---

### Test Suite 7: Read-Only Report Sharing
- **TC-7.1: Share Reflection Compass Report**:
  - **Given**: User is viewing a Reflection Compass report.
  - **When**: User clicks the "Share" button in the report header and selects a trusted contact from the modal.
  - **Then**: Backend executes `POST /v1/shares`, creates a top-level `shareGrant` record binding the owner UID, report ID, and viewer email, and updates the UI with a confirmation toast.
- **TC-7.2: Access Shared Report as Viewer**:
  - **Given**: User B is signed in with email `mentor@example.com` which received a share grant.
  - **When**: User B navigates to the "Shared With Me" tab under Trusted People.
  - **Then**: The shared report is listed showing the owner's name and report title. Clicking "View Shared Report" calls `GET /v1/shares/:grantId` and renders the read-only report view with raw session isolation preserved.
- **TC-7.3: Unauthorized Access Prevention**:
  - **Given**: User C attempts to access a share grant intended for `mentor@example.com`.
  - **When**: User C calls `GET /v1/shares/:grantId`.
  - **Then**: Server returns `403 Forbidden` with `{ error: "You are not authorized to view this shared report." }`.

---

### Test Suite 8: Progress & Consistency Trends
- **TC-8.1: Streak and Metrics Calculation**:
  - **Given**: User navigates to the "Progress" tab.
  - **When**: Timeframe selector is toggled (7, 30, 90 days).
  - **Then**:
    1. Backend calls `GET /v1/progress?rangeDays=X`.
    2. Pure server-side aggregation calculates current consecutive streak, all-time longest streak, total sessions, and Compass syntheses.
    3. Theme distribution frequencies and recurring challenges (appearing in >= 2 reports) are rendered with visual progress bars.
    4. Zero calls are made to Gemini for progress metrics.

---

### Test Suite 9: Trends & Influencers Discovery (Search Grounding)
- **TC-9.1: Opt-in External Discovery Trigger**:
  - **Given**: User navigates to the "Discover" tab.
  - **When**: User clicks "Discover Fresh Resources".
  - **Then**:
    1. Backend calls `POST /v1/discover` with target themes.
    2. Gemini invokes `@google/genai` with `tools: [{ googleSearch: {} }]`.
    3. Only high-level themes (e.g. "Mindfulness & Clarity", "Deep Work") are transmitted outbound; zero private journal text is shared.
    4. Response validates against Zod schema into categorized recommendations (Books, Articles, Creators, Podcasts) and persists to `/users/{uid}/discoveries`.
- **TC-9.2: Grounding Failure Graceful Recovery**:
  - **Given**: External search tool experiences transient network failure.
  - **Then**: The backend fallback returns foundational educational recommendations for the theme without throwing a 500 error.

---

### Test Suite 10: Google Workspace Auto-Scan & Import
- **TC-10.1: Meeting Auto-Scan**:
  - **Given**: User has connected Google Workspace.
  - **When**: Dashboard loads.
  - **Then**: AutoScan prompt card identifies recent calendar meetings with linked Google Docs notes and provides a one-click import into a structured reflection draft.
