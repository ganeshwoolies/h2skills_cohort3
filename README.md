# Personal Gemini Journal

> A private, AI-powered journaling and reflection workspace built on Google Cloud Run, Cloud Firestore, the Google Gemini API (`@google/genai`), and Google Workspace.

[![Google Cloud Run](https://img.shields.io/badge/Deployed%20on-Google%20Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Cloud Firestore](https://img.shields.io/badge/Database-Cloud%20Firestore-FFA000?logo=firebase&logoColor=white)](https://firebase.google.com/docs/firestore)
[![Gemini API](https://img.shields.io/badge/Model-Gemini%203.6%20Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Design Theme](https://img.shields.io/badge/Design-Bento%20Grid-0F172A)](https://tailwindcss.com/)

---

## Table of Contents
1. [Product Overview & Capabilities](#product-overview--capabilities)
2. [Threat Model & Security Architecture](#threat-model--security-architecture)
3. [Prerequisites & GCP API Activation](#prerequisites--gcp-api-activation)
4. [Secret Manager & IAM Configuration](#secret-manager--iam-configuration)
5. [Cloud Firestore & Security Rules](#cloud-firestore--security-rules)
6. [Local Development](#local-development)
7. [Cloud Run Deployment Flow](#cloud-run-deployment-flow)
8. [Challenge Verification & Campaign Labeling](#challenge-verification--campaign-labeling)
9. [Demonstration Script](#demonstration-script)

---

## Product Overview & Capabilities

Personal Gemini Journal allows authenticated users to engage in mindful, multi-turn reflective conversations with Gemini. Conversations are auto-summarized, securely persisted in Cloud Firestore with strict user isolation, and synthesizable into **Reflection Compass** reports, **Progress Trends**, and **Trends & Influencers** recommendations.

### Key Capabilities
- **Multi-turn Conversational Reflection**: Structured, empathetic reflection dialogues with Gemini featuring automatic context retention and server-side sequence numbering.
- **Reflection Compass**: Periodic syntheses across multiple journal sessions that surface core growth themes, progress highlights, challenges, prioritized next steps, and self-inquiry prompts.
- **Trusted People & Read-Only Sharing**: Securely share Reflection Compass syntheses with mentors or trusted peers without exposing raw session histories or database write privileges.
- **Progress & Consistency Trends**: Pure server-side aggregation of daily reflection streaks, weekly journaling cadence, theme frequencies, and recurring friction points over 7, 30, or 90 days.
- **Trends & Influencers (Google Search Grounding)**: Opt-in discovery of authoritative books, articles, creators, and podcasts grounded in user themes via `@google/genai` search grounding—transmitting only high-level themes, never raw journal text.
- **Google Workspace Auto-Scan**: Detects recent calendar meetings with associated Google Docs notes and offers one-click import into a structured reflection draft.

### Security Invariants
- **Zero Client-Side Credentials**: The Gemini API key and Firebase Admin credentials exist strictly inside the Cloud Run backend container.
- **Server-Authoritative Mutations**: Direct client write access to sessions, reports, and sharing collections is permanently locked in Firestore Security Rules (`allow write: if false;`).
- **Strict User Isolation**: All personal documents are stored under `/users/{uid}/...`. Every API route requires a verified Firebase ID token and resolves access through `decodedToken.uid`.

---

## Threat Model & Security Architecture

| Threat Zone | Specific Threat Scenario | OWASP Mapping | Severity | Implemented Technical Countermeasure |
| :--- | :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious client submits oversized prompts (>100k chars), invalid email formats, or attempts injection via query parameters. | OWASP A03 / LLM02 | High | **Zod Schema Enforcement**: All endpoints parse incoming payloads with strict bounds (`min(1).max(8000)`, `email()`, `min(1).max(365)`). Express body parser limited to 2MB. |
| **2. Planning & Reasoning** | Prompt injection: User input embeds instructions to jailbreak the model or extract system rules; indirect injection via search results. | OWASP LLM01 | High | **System Instruction Boundary Hardening**: Core system prompt explicitly flags user entries as untrusted plain text. External search queries are restricted strictly to abstracted theme keywords, and outputs are parsed against typed schemas. |
| **3. Tool Execution & APIs** | Attacker calls `/v1/sessions/:id/messages` without authorization or attempts to access another user's shared report. | OWASP A01 / LLM06 | Critical | **Firebase ID Token Verification**: Bearer token required on all `/v1/*` routes, validated with `verifyIdToken(token)`. Share grant access requires matching the authenticated user's verified token email (`user.email === grant.viewerEmail`). |
| **4. Memory & State** | Cross-user data leakage: User A attempts to view or modify User B's sessions, reports, or share grants. | OWASP A01 / LLM08 | Critical | **Dual-Layer Isolation**: <br>1. Firestore Security Rules enforce strict owner-bound access `request.auth.uid == userId` and lock write access permanently.<br>2. `shareGrants`, `trustedPeople`, and `discoveries` are blocked from client reads/writes in rules (`allow read, write: if false;`). Server derives identity strictly from verified token. |
| **5. Inter-System Comms** | Gemini API key leakage via client bundle, network headers, or GitHub commits. | OWASP A02 / LLM05 | Critical | **Google Cloud Secret Manager**: `GEMINI_API_KEY` is loaded exclusively inside Cloud Run backend memory. No key appears in the Vite frontend bundle or client network calls. |

---

## Prerequisites & GCP API Activation

### 1. Install Tools
- [Google Cloud SDK (`gcloud` CLI)](https://cloud.google.com/sdk/docs/install)
- [Node.js 20+ and npm](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli)

### 2. Set Project & Enable APIs
```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="us-central1"

gcloud config set project $PROJECT_ID

# Enable required Google Cloud services
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Secret Manager & IAM Configuration

### 1. Create the Gemini API Key Secret
```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

### 2. Configure Least-Privilege Service Account
```bash
# Create dedicated runtime service account
gcloud iam service-accounts create gemini-journal-sa \
  --display-name="Personal Gemini Journal Runtime SA"

# Grant Secret Manager Secret Accessor role
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:gemini-journal-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Datastore/Firestore User role for database reads/writes
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gemini-journal-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

*Note: For default Compute service accounts, apply binding using project number:*
```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Cloud Firestore & Security Rules

### 1. Provision Firestore in Native Mode
```bash
gcloud firestore databases create --location=$REGION --type=firestore-native
```

### 2. Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions for ownership verification
    function signedIn() { return request.auth != null; }
    function owns(userId) { return signedIn() && request.auth.uid == userId; }

    // User profile document: authenticated owner can read and manage their own user doc
    match /users/{userId} {
      allow read, write: if owns(userId);

      match /sessions/{sessionId} {
        allow read, write: if owns(userId);

        match /messages/{messageId} {
          allow read, write: if owns(userId);
        }
      }

      // Reports collection (Reflection Compass)
      match /reports/{reportId} {
        allow read, write: if owns(userId);
      }

      // Trusted People collection (server-only mutation and access)
      match /trustedPeople/{personId} {
        allow read, write: if false;
      }

      // Discoveries collection (server-only mutation and access)
      match /discoveries/{discoveryId} {
        allow read, write: if false;
      }

      // Interactions collection
      match /interactions/{interactionId} {
        allow read, write: if owns(userId);
      }
    }

    // Top-level shareGrants collection: server-only, never directly queryable or mutable by clients
    match /shareGrants/{grantId} {
      allow read, write: if false;
    }

    // Default-deny safety net for any unmatched paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

*Deploy rules using Firebase CLI:*
```bash
firebase deploy --only firestore:rules
```

---

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Run local development server (binds on port 3000)
npm run dev
```

---

## Cloud Run Deployment Flow

### One-Command Deployment with `gcloud run deploy`
```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=gemini-journal-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},NODE_ENV=production" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --update-labels=dev-tutorial=cloud-run-ai-challenge
```

---

## Challenge Verification & Campaign Labeling

To ensure verification in the Cloud Run AI Challenge, confirm the service label is bound:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

Verify service labels and status:
```bash
gcloud run services describe personal-gemini-journal \
  --region=$REGION \
  --format="table(metadata.name,metadata.labels,status.url)"
```

---

## Demonstration Script

1. **Sign-In & Landing Page**:
   - Open the live URL. Note the Bento Grid presentation and the security statement.
   - Click **"Continue with Google"** to authenticate.
2. **New Journal Session**:
   - On the Private Dashboard, click **"New Journal Session"**.
   - Enter a title (e.g., *"Sprint Planning & Mindset"*) and tags (e.g., `work`, `focus`).
3. **Conversational Multi-Turn Reflection**:
   - Type: *"I am feeling pulled in five directions this morning between customer escalations and our core roadmap."*
   - Observe the real-time loading indicator and Gemini's empathetic, structured response framing priorities.
   - Reply: *"How can I set clear boundaries with my team without seeming unsupportive?"*
   - Observe the multi-turn context retention and sequencing.
4. **Automated Structured Summary**:
   - Click **"Generate Summary"**.
   - Note the immediate generation of Headline, Core Themes, Key Takeaways, and Actionable Horizon.
5. **Reflection Compass Generation**:
   - Navigate to the **Compass** tab.
   - Click **"Generate Reflection Compass"** for the current period.
   - Review the synthesized report featuring overarching themes, progress highlights, challenges, prioritized next steps, and reflection prompts.
6. **Trusted People & Read-Only Report Sharing**:
   - In the active Compass report header, click **"Share"**.
   - Navigate to **Trusted People**, add a trusted contact's email (e.g., `peer@example.com`), and grant access to the report.
   - Switch to the "Shared With Me" tab to experience the secure read-only report view as seen by invited viewers.
7. **Progress & Consistency Trends**:
   - Navigate to the **Progress** tab.
   - Toggle between 7, 30, and 90-day timeframes to review consecutive journaling streaks, weekly activity cadence, theme distributions, and recurring friction points.
8. **Trends & Thought Leaders Discovery**:
   - Navigate to the **Discover** tab.
   - Click **"Discover Fresh Resources"** to trigger Gemini with Google Search grounding.
   - Inspect curated recommendations across Books, Articles, Creators, and Podcasts mapped directly to your reflection themes.
9. **Data Isolation Verification**:
   - Sign out, and inspect network requests: verify that no Gemini API keys were transmitted and all Firestore documents remained strictly bounded to your user account.
