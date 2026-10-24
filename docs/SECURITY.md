# CampusFind Security Review and Safeguards

## 1. Authentication & Identity Safeguards
- **Identity-Bound Listings:** All new listings and claims require an authenticated Supabase session. The server assigns `owner_id = auth.uid()` and prevents client tampering.
- **Private Claim Protection:** Verification details in `claims` are protected by database Row-Level Security (RLS) so that only the claimant, the item's verified owner, and designated campus staff can read claim details. Unrelated visitors cannot inspect claim verification text or private phone numbers.
- **Password & Session Security:** Handled via Supabase Auth using secure JWTs, salted hashing, and HTTPS transport.

## 2. Abuse Prevention & Content Moderation
- **Input Validation & Length Constraints:** Title (3–100 chars), Description (5–2000 chars), Location (2–150 chars), Date (cannot be in the future).
- **Abuse Flagging:** Users can flag listings for administrative review (sensitive data leaks, spam, fraud, or harassment). Flagged listings enter moderation workflows.
- **Image Upload Constraints:** Strict client and storage-level file size checks (maximum 5MB) and MIME-type restrictions (PNG, JPG, WebP).
- **Safe Handover Practice:** Found listings feature an explicit handover checkbox indicating if the item has been turned in to staffed campus security or building front desks.

## 3. Development vs. Production Isolation
- **Explicit Test Data Labeling:** All sample test records generated via the development seed tool are tagged with `is_demo: true` and prefixed with `[DEMO / TEST DATA]`.
- **Targeted Test Cleanup:** The cleanup mechanism targets only rows matching `is_demo = true`, strictly preventing accidental deletion of real user submissions.
- **No Production Auto-Seeding:** Production builds never automatically generate fake records. When the database is fresh, the board reflects true zero-state until users or staff publish reports.
- **No Secret Key Exposure:** Only publishable anon keys (`VITE_SUPABASE_ANON_KEY`) are utilized in frontend bundles; the Supabase service-role secret is never included in client code or source repositories.
