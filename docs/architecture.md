# Architecture: Personal Gemini Journal

## System Overview

Personal Gemini Journal is an enterprise-grade, privacy-first personal reflection system deployed to **Google Cloud Run**. It pairs a responsive, Bento Grid-designed React frontend with a secure Node.js 20 backend, integrated with Cloud Firestore and the Gemini API (`@google/genai`).

## Architectural Components

1. **Frontend Tier (Vite + React 19 + Tailwind CSS)**:
   - Hosted in the Cloud Run container and served via Express static middleware.
   - Handles client authentication exclusively via **Google Sign-In** using Firebase Authentication client SDK.
   - Communicates with backend endpoints using `Authorization: Bearer <ID-Token>` headers.
   - Zero access to the `GEMINI_API_KEY` or direct database mutation rights.

2. **Backend Tier (Node.js 20 / Express / TypeScript)**:
   - Provides stateless REST endpoints under `/v1/*` and health probe `/healthz`.
   - Validates Firebase ID tokens using the `firebase-admin` SDK with token revocation checks.
   - Enforces transaction integrity on multi-turn conversations and generates message sequence counts server-side.
   - Interacts with Google Gemini using `@google/genai` through a 4-tier model fallback ladder (`gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, `gemini-3.7-flash`).

3. **Storage Tier (Cloud Firestore)**:
   - Document paths:
     - `/users/{uid}`
     - `/users/{uid}/sessions/{sessionId}`
     - `/users/{uid}/sessions/{sessionId}/messages/{messageId}`
     - `/users/{uid}/reports/{reportId}`
   - Security Rules:
     - Direct browser reads strictly bound to `request.auth.uid == userId`.
     - Direct browser writes permanently locked (`allow write: if false;`).
     - All mutations performed server-side via Firebase Admin SDK with server timestamps.

4. **Security & Secrets**:
   - Google Secret Manager manages the `GEMINI_API_KEY`.
   - Cloud Run service account assigned `roles/secretmanager.secretAccessor` and `roles/datastore.user`.
