# Personal Gemini Journal

> A private, AI-powered journaling and reflection workspace built on Google Cloud Run, Cloud Firestore, and the Google Gemini API.

[![Google Cloud Run](https://img.shields.io/badge/Deployed%20on-Google%20Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Cloud Firestore](https://img.shields.io/badge/Database-Cloud%20Firestore-FFA000?logo=firebase&logoColor=white)](https://firebase.google.com/docs/firestore)
[![Gemini API](https://img.shields.io/badge/Model-Gemini%203.6%20Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Design Theme](https://img.shields.io/badge/Design-Bento%20Grid-0F172A)](https://tailwindcss.com/)

---

## Table of Contents
1. [Product Overview & Architectural Flow](#product-overview--architectural-flow)
2. [Threat Model & Security Architecture](#threat-model--security-architecture)
3. [Prerequisites & GCP API Activation](#prerequisites--gcp-api-activation)
4. [Secret Manager & IAM Configuration](#secret-manager--iam-configuration)
5. [Cloud Firestore & Security Rules](#cloud-firestore--security-rules)
6. [Local Development](#local-development)
7. [Cloud Run Deployment Flow](#cloud-run-deployment-flow)
8. [Challenge Verification & Campaign Labeling](#challenge-verification--campaign-labeling)
9. [Demonstration Script](#demonstration-script)

---

## Product Overview & Architectural Flow

Personal Gemini Journal allows authenticated users to engage in mindful, multi-turn reflective conversations with Gemini. Conversations are auto-summarized, securely persisted in Cloud Firestore with strict user isolation, and synthesizable into **Reflection Compass** reports highlighting weekly growth, challenges, and next actions.

### Architecture Highlights
- **Zero Client-Side Credentials**: The Gemini API key and Firebase Admin credentials exist strictly inside the Cloud Run backend container.
- **Server-Authoritative Mutations**: Direct client write access to sessions and reports is disabled in Firestore Security Rules (`allow write: if false;`). All mutations are managed by the backend using server timestamps and atomic transactions for sequence counting.
- **Strict User Isolation**: All personal documents are stored under `/users/{uid}/...`. Every API route requires a verified Firebase ID token and resolves access through `decodedToken.uid`.

---

## Threat Model & Security Architecture

| Threat Zone | Risk Scenario | Mitigation Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | Oversized payloads or prompt injection | Strict Zod schemas bounding inputs (1-8,000 characters); 2MB Express body limit. |
| **Planning & Reasoning** | Jailbreaking / Persona drift | Hardened system instructions treating user content as untrusted plain text. |
| **Tool Execution** | Unauthorized API calls / SSRF | Strict Firebase Bearer token verification using Google's public certificates (`verifyIdToken(token)`). |
| **Memory & State** | Cross-user data leaks | Owner-bound Firestore rules (`request.auth.uid == userId`) and server-side authorization filters. |
| **Inter-System Comms** | API key leakage | Credentials stored exclusively in Google Cloud Secret Manager. |

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
    function signedIn() { return request.auth != null; }
    function owns(userId) { return signedIn() && request.auth.uid == userId; }

    match /users/{userId} {
      allow read, write: if owns(userId);

      match /sessions/{sessionId} {
        allow read, write: if owns(userId);

        match /messages/{messageId} {
          allow read, write: if owns(userId);
        }
      }

      match /reports/{reportId} {
        allow read, write: if owns(userId);
      }

      match /interactions/{interactionId} {
        allow read, write: if owns(userId);
      }
    }

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

# Configure environment variables
cp .env.example .env
# Set your GEMINI_API_KEY in .env

# Run unit tests
npm test

# Start the full-stack development server (Express + Vite on Port 3000)
npm run dev
```

Visit `http://localhost:3000` to interact with the application.

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
   - Navigate to the **Reflection Compass** section.
   - Click **"Generate My Compass"** for the current period.
   - Review the synthesized report featuring overarching themes, progress highlights, challenges, prioritized next steps, and reflection prompts.
6. **Data Isolation Verification**:
   - Sign out, and inspect network requests: verify that no Gemini API keys were transmitted and all Firestore documents remained strictly bounded to your user account.
