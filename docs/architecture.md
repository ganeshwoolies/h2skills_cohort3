# Architecture: Personal Gemini Journal

## System Overview

Personal Gemini Journal is an enterprise-grade, privacy-first personal reflection system deployed to **Google Cloud Run**. It pairs a responsive, Bento Grid-designed React 19 frontend with a secure Node.js 20 backend, integrated with Cloud Firestore, the Google Gemini API (`@google/genai`), and optional Google Workspace integrations (Calendar & Drive).

---

## Architectural Components

### 1. Frontend Tier (Vite + React 19 + Tailwind CSS)
- Hosted in the Cloud Run container and served via Express static middleware.
- Handles client authentication exclusively via **Google Sign-In** using Firebase Authentication client SDK.
- Communicates with backend endpoints using `Authorization: Bearer <ID-Token>` headers.
- Views provided:
  - **Private Dashboard**: Session history, date/tag filtering, quick actions, and AutoScan prompt card.
  - **Active Reflection**: Multi-turn conversational interface with Gemini, structured summaries, and auto-save.
  - **Reflection Compass**: Multi-session longitudinal reports detailing overarching themes, progress, challenges, and next actions.
  - **Progress Trends**: 7/30/90-day streak calculation, weekly activity cadence, theme frequency, and recurring friction points.
  - **Trends & Influencers**: Opt-in discovery of authoritative books, articles, creators, and podcasts grounded in user themes via Google Search.
  - **Trusted People**: Granular contact management, read-only report sharing, and dedicated reader view for reports shared by others.
- Zero access to the `GEMINI_API_KEY` or direct database mutation rights.

### 2. Backend Tier (Node.js 20 / Express / TypeScript)
- Provides stateless REST endpoints under `/v1/*` and health probe `/healthz`.
- Validates Firebase ID tokens using the `firebase-admin` SDK with token revocation checks.
- Enforces transaction integrity on multi-turn conversations and generates message sequence counts server-side.
- Interacts with Google Gemini using `@google/genai` through a 4-tier model fallback ladder:
  - Primary: `gemini-3.6-flash`
  - High-Availability Fallback: `gemini-3.1-flash-lite`
  - Dynamic Alias: `gemini-flash-latest`
  - Deep Reasoning Fallback: `gemini-3.7-flash`
- External Discovery Service: Leverages Gemini with Google Search tool (`tools: [{ googleSearch: {} }]`) using strictly abstracted themes as query inputs, guaranteeing zero raw journal transmission.

### 3. Storage Tier (Cloud Firestore)
- **Document Hierarchies**:
  - `/users/{uid}`: User profile and preferences.
  - `/users/{uid}/sessions/{sessionId}`: Journal session metadata, title, tags, and structured summary.
  - `/users/{uid}/sessions/{sessionId}/messages/{messageId}`: Multi-turn message history with server sequence IDs.
  - `/users/{uid}/reports/{reportId}`: Reflection Compass reports and synthesized metrics.
  - `/users/{uid}/trustedPeople/{personId}`: Trusted contacts designated for report sharing.
  - `/users/{uid}/discoveries/{discoveryId}`: Curated recommendations history and theme metadata.
  - `/shareGrants/{grantId}`: Top-level server-authoritative read grants associating owner report IDs with viewer emails.
- **Security Rules (`firestore.rules`)**:
  - Direct browser reads to user documents strictly bound to `request.auth.uid == userId`.
  - Direct browser writes to all collections permanently locked (`allow write: if false;`).
  - Direct client access to `/users/{uid}/trustedPeople`, `/users/{uid}/discoveries`, and `/shareGrants` completely disabled (`allow read, write: if false;`), ensuring 100% server authority.
  - Default-deny rule on all unmatched paths.

### 4. Security & Secrets
- Google Secret Manager manages the `GEMINI_API_KEY`.
- Cloud Run service account assigned `roles/secretmanager.secretAccessor` and `roles/datastore.user`.
- No sensitive operational keys exist in client code or version control.
