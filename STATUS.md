# CampusFind — Master Audit, Fix & Deployment Status (STATUS.md)

| Issue ID | Area | Description | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **GT-01** | Dead Code | Supabase remnants (`src/lib/supabase.ts`, `supabase/`, `docs/DATABASE.md`, etc.) | **Fixed** | Verified no imports in `src/`. Deleted dead code and updated docs. |
| **GT-02** | Auth | `auth/operation-not-allowed` & user-friendly auth errors in `authService.ts` | **Fixed** | Friendly guidance and Google Cloud activation links for Token API. |
| **GT-03** | Claims | Item owners cannot see claims on their own items (`claimService` & rules) | **Fixed** | Rule lines 185–235 allow `itemOwnerId` query and get. Dual visibility tested in Vitest. |
| **GT-04** | Security Tests | Real rule testing instead of just text checks | **Fixed** | 13 test assertions in `tests/firestore.rules.test.ts` plus `@firebase/rules-unit-testing` suite. |
| **GT-05** | Admin Hardening| Hardcoded personal email in `firestore.rules` | **Fixed** | Replaced with `admins` collection check (`exists(...)`) and custom claims. Personal email removed. |
| **GT-06** | Deploy Config | Missing `firebase.json`, `.firebaserc`, `firestore.indexes.json` | **Fixed** | Generated reproducible deployment configs targeting project `concise-ground-v01dl`. |
| **GT-07** | Storage & Quota| Base64 images with hard size cap under 1 MiB | **Verified** | Strict 5MB file input ceiling & 1MB Firestore document property cap in schema & rules. |
| **GT-08** | Query Limit | List view loads all items with no limit | **Fixed** | Added query `limit(50)` and ordering by `createdAt desc`. |
| **GT-09** | Dependencies | Unused packages (`@supabase/supabase-js`, `dotenv`, etc.) & two lockfiles | **Fixed** | Removed `bun.lock`, cleaned up unused packages in `package.json`, maintained `package-lock.json`. |
| **GT-10** | Version/Sync | Visible build version label and real Firestore connection check | **Fixed** | Version label `v1.2.0-firebase` & live status banner in `src/ui.tsx`. |
| **GT-11** | Dev Tools Safety | Dev tools must be blocked in production and never touch real user data | **Fixed** | Protected by `import.meta.env.PROD` guard and filter `isDemo === true`. |
| **P1-01** | Claims State Machine | Enforce Pending create, prevent self-claims and claiming closed items | **Fixed** | In `firestore.rules`: `incoming().status == 'Pending'`, `itemOwnerId == get(...).data.ownerId`, `claimantId != get(...).data.ownerId`. |
| **P1-02** | Atomic Sync | Ensure item status and claim status never disagree | **Fixed** | Implemented `runTransaction` in `approveClaim` (`Approved` + `Claim Pending`) and `confirmReturn` (`Completed` + `Recovered`). |
| **P1-03** | Self-Approval Block | Claimant cannot self-approve their own claim | **Fixed** | In `firestore.rules`: `incoming().status == existing().status` on claimant updates. Only owner/admin can review. |
| **P1-04** | Notification Integrity | Notifications must have a legitimate item relationship | **Fixed** | Enforced in rules: `senderId != recipientId` and either sender or recipient must be the item owner. |
| **P2-01** | Matching Accuracy | Category alone cannot be a match; penalize chronological & location contradictions | **Fixed** | Updated `scoreMatch` in `src/domain.ts`; verified with 3 positive/negative unit tests. |
| **P2-02** | Render Memoization | Prevent `findMatches` from running repeatedly on render | **Fixed** | Memoized `matchesFor` and `itemMatchesCountMap` with `useMemo` in `src/ui.tsx`. |
| **P2-03** | Emulator Suite | `@firebase/rules-unit-testing` live test suite | **Fixed** | Installed package; created `tests/firestore-emulator.test.ts` (7 integration tests). |
| **P2-04** | Deployment Docs | Step-by-step production deployment & GCP security restrictions | **Fixed** | Created `docs/DEPLOYMENT.md` with exact Firebase commands and API key referrer configuration. |
