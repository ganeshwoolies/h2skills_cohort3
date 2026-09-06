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
  - **Then**: Submit button remains disabled or returns a clear validation error without sending a network call.
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

### Test Suite 5: Reflection Compass Reports
- **TC-5.1: Generate Reflection Compass**:
  - **Given**: User has completed sessions over the past week.
  - **When**: User navigates to the Reflection Compass view, selects a date window (e.g., Last 7 Days), and clicks "Generate My Compass".
  - **Then**:
    1. Backend aggregates sessions in date range, invokes Gemini structured report generator.
    2. Server validates output with Zod against `CompassContentSchema`.
    3. Saves report under `/users/{uid}/reports/{reportId}`.
    4. Displays comprehensive report containing Headline, Key Themes, Wins & Progress, Recurring Challenges, Prioritized Next Actions, and Reflection Questions.
- **TC-5.2: Report Deletion**:
  - **Given**: User views a saved Reflection Compass report.
  - **When**: User clicks "Delete Report" and confirms.
  - **Then**: Backend executes `DELETE /v1/reports/:id`, report is removed from list, and feedback confirmation toast appears.

---

### Test Suite 6: Cross-User Isolation & Security Invariants
- **TC-6.1: Cross-User Read Defense**:
  - **Given**: User A is authenticated and obtains User B's sessionId.
  - **When**: User A issues `GET /v1/sessions/{user_B_session_id}`.
  - **Then**: Server returns `404 Not Found` (never 403, preventing resource enumeration).
- **TC-6.2: Direct Client Write Lockdown**:
  - **Given**: Malicious client attempts direct Firestore client SDK call `setDoc(doc(db, "users", "any_id", "sessions", "new_id"), {})`.
  - **Then**: Firestore Security Rules immediately reject the write with `PERMISSION_DENIED` (`allow write: if false;`).
