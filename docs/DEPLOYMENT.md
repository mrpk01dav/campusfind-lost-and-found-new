# CampusFind — Production Deployment & Security Guide

This document outlines the exact procedures to build, test, secure, and deploy the CampusFind application to production.

---

## 1. Architecture & Hosting Topology

- **Web Frontend Application:**
  - **Framework:** React 19 + TypeScript + Vite 8
  - **Dev Server / Preview:** AI Studio Cloud Run container (`asia-northeast1.run.app`)
  - **Static Hosting:** Firebase Hosting (configured in `firebase.json` via `public: "dist"`)
- **Backend & Persistence:**
  - **Database:** Google Cloud Firestore (Multi-region / Eur3)
  - **Project ID:** `concise-ground-v01dl`
  - **Database ID:** `ai-studio-campusfindlostan-893fbce3-65b7-4915-a46a-37fa7f28e695`
  - **Authentication:** Firebase Auth (Google Sign-In + Email/Password)

---

## 2. Pre-Deployment Verification

Always run local automated checks before any deployment:

```bash
# 1. Typecheck without emitting code
npm run typecheck

# 2. Run automated test suite (domain logic, UI flows, and security rules)
npm test

# 3. Create production bundle
npm run build
```

Expected output:
- `tsc --noEmit` exits with 0 errors.
- Vitest passes all tests across `src/domain.test.ts`, `tests/firestore.rules.test.ts`, and `tests/app.test.tsx`.
- `dist/` is created containing minified HTML, JS, and CSS bundles.

---

## 3. Deploying Firestore Security Rules & Indexes

Firestore Security Rules and composite indexes **are not deployed by Git pushes**. They must be deployed directly using the Firebase CLI or AI Studio integration tools.

### Deploy Security Rules Only:
```bash
firebase deploy --only firestore:rules
```
*Verification:* The rules take effect globally within 10–30 seconds. Unauthenticated writes, self-claims, and forged notifications are rejected at the database level.

### Deploy Composite Indexes Only:
```bash
firebase deploy --only firestore:indexes
```
*Index definition source:* `firestore.indexes.json` contains indexes for:
- `claims`: `(claimantId ASC, createdAt DESC)`
- `claims`: `(itemOwnerId ASC, createdAt DESC)`
- `notifications`: `(recipientId ASC, createdAt DESC)`
- `rewards`: `(userId ASC, createdAt DESC)`
- `reports`: `(reporterId ASC, createdAt DESC)`

---

## 4. Deploying Web Hosting (Firebase Hosting)

Deploy the compiled production build from `dist/`:

```bash
# Ensure build is fresh
npm run build

# Deploy hosting
firebase deploy --only hosting
```

Or deploy everything together:
```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

---

## 5. Google Cloud Console Security Lockdown (Console Steps)

To prevent quota exhaustion or unauthorized third-party usage of your Firebase web client configuration:

1. Visit [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials?project=37299026377).
2. Click on the API Key (`AIzaSyCPyEm8vFFVpy3R2SGG_o9m-0QYHe9g6LI`).
3. Under **Application restrictions**:
   - Select **Websites**.
   - Under **Website restrictions**, add your authorized domains:
     - `https://ais-dev-gxahdlizzxzlxd7lltg6zy-647441154677.asia-northeast1.run.app/*`
     - `https://ais-pre-gxahdlizzxzlxd7lltg6zy-647441154677.asia-northeast1.run.app/*`
     - `https://concise-ground-v01dl.web.app/*`
     - `https://concise-ground-v01dl.firebaseapp.com/*`
     - `http://localhost:3000/*` (for local development)
4. Under **API restrictions**:
   - Restrict to:
     - **Cloud Firestore API**
     - **Identity Toolkit API**
     - **Token Service API** (`securetoken.googleapis.com`)
5. Click **Save**.

---

## 6. Safe Test Data Management in Production

- The development seed tools (`Seed Test Data` / `Clean Up Test Data`) are strictly gated by `import.meta.env.PROD`.
- They are completely omitted from production builds.
- Cleanup routines strictly filter records matching `isDemo === true`, guaranteeing real user records are never deleted.
