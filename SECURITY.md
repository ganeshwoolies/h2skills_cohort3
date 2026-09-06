# Security Constitution & Operational Posture: Personal Gemini Journal

## Security Principles

1. **No Password Flows**: All user authentication is strictly delegated to Google Identity / Firebase Authentication via Federated Google Sign-In. The application never stores, touches, or hashes user passwords.
2. **Zero Client-Side Secrets**: Neither the `GEMINI_API_KEY`, service account keys, nor any privileged tokens are exposed to client-side code, bundle artifacts, or browser network inspectors. All interactions with the Gemini API occur strictly server-side within the Cloud Run runtime container.
3. **Owner-Bound Security & Isolation**: In compliance with zero-trust database principles, all Firestore rules enforce `request.auth.uid == userId` for all paths under `/users/{userId}/*`. Resources requested under non-matching paths return generic 404s without disclosing document existence.
4. **Resilient Data Persistence**: Server-side routes utilize atomic sequence counters, server timestamps, strict undefined-stripping, and resilient local persistence when container IAM roles are partitioned.
5. **Cryptographic Token Verification**: Every protected request verifies the Firebase ID token signature, issuer, audience, and expiry against Google's public certificates using `verifyIdToken(token)`.
6. **Input & Output Validation (OWASP A03 / LLM02 / LLM05)**:
   - All inbound payloads are length-bounded (1-8,000 characters) and schema-validated with Zod.
   - All structured model outputs (Session Summaries and Reflection Compass reports) are rigorously parsed and schema-validated before persisting to the database.
   - User reflections are marked as untrusted data in LLM system instructions to thwart indirect prompt injection attempts (OWASP LLM01).

## Reporting Vulnerabilities

If you discover a potential security flaw, report it responsibly via our vulnerability disclosure channel rather than public issue trackers.
