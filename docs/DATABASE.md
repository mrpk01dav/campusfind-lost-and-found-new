# CampusFind Cloud Database Architecture (Supabase / PostgreSQL)

CampusFind uses Supabase (PostgreSQL 15+) with Row Level Security (RLS) to enforce data boundaries, authenticated listing ownership, private claim verification, and abuse protection.

---

## 1. Tables Overview

### `profiles`
Stores extended user profile information linked to Supabase Auth (`auth.users`).
- `id` (UUID, Primary Key): References `auth.users(id) ON DELETE CASCADE`.
- `display_name` (Text, Not Null): Public user name or student display handle.
- `email` (Text, Not Null): User's authenticated email address.
- `avatar_url` (Text, Nullable): Optional profile image URL.
- `role` (Text, Check: `student`, `staff`, `moderator`, `admin`): Default `student`.
- `created_at` / `updated_at` (Timestamptz): System timestamps.

*Trigger*: An automatic PostgreSQL trigger `on_auth_user_created` creates a profile row whenever a new account is registered in `auth.users`.

### `items`
Stores lost and found listings submitted by authenticated users.
- `id` (UUID, Primary Key): Generated using `gen_random_uuid()`.
- `type` (Text, Check: `lost`, `found`): Category of the listing.
- `title` (Text, 3–100 chars): Headline of the item.
- `category` (Text): Electronics, ID & Cards, Books & Notes, Keys, etc.
- `description` (Text, 5–2000 chars): Descriptive features.
- `color` (Text): Visual color or distinctive markings.
- `location` (Text, 2–150 chars): Approximate campus area found or last seen.
- `date` (Date, Not Null): Date item was lost or found.
- `time` (Text, Nullable): Optional approximate time.
- `image_url` (Text, Nullable): Public URL to image stored in Supabase Storage (`item-images`).
- `handover` (Boolean, Default `false`): Whether item is physically at a campus security office.
- `status` (Text, Check: `Open`, `Possible Match`, `Claim Pending`, `Recovered`, `Closed`).
- `owner_id` (UUID, Foreign Key): References `auth.users(id) ON DELETE CASCADE`.
- `owner_name` (Text): Cached owner display name for performant listing rendering.
- `is_demo` (Boolean, Default `false`): Distinguishes development test seed records.
- `moderation_status` (Text, Check: `pending`, `approved`, `flagged`, `rejected`, `removed`).
- `created_at` / `updated_at` (Timestamptz): System timestamps.

### `claims`
Stores private ownership verification claims submitted for found items.
- `id` (UUID, Primary Key).
- `item_id` (UUID, Foreign Key): References `items(id) ON DELETE CASCADE`.
- `claimant_id` (UUID, Foreign Key): References `auth.users(id) ON DELETE CASCADE`.
- `claimant_name` (Text): Claimant's name.
- `contact_phone` (Text, Nullable): Optional phone number or communication handle.
- `details` (Text, 12–1500 chars): Secret identifying details known only to the true owner.
- `status` (Text, Check: `Pending`, `Under Review`, `Approved`, `Rejected`, `Completed`).
- `reviewer_id` (UUID, Foreign Key): Campus desk reviewer or listing owner.
- `resolution_note` (Text, Nullable): Outcome or pickup instructions.
- `created_at` / `updated_at` (Timestamptz).

### `reports`
Stores community abuse reports for inappropriate content, spam, or privacy breaches.
- `id` (UUID, Primary Key).
- `item_id` (UUID, Foreign Key): References `items(id) ON DELETE CASCADE`.
- `reporter_id` (UUID, Foreign Key): References `auth.users(id) ON DELETE CASCADE`.
- `reason` (Text, 3–100 chars): Reason code or description.
- `details` (Text, Nullable): Optional context.
- `status` (Text, Check: `pending`, `reviewed`, `dismissed`, `action_taken`).
- `created_at` (Timestamptz).

---

## 2. Row Level Security (RLS) Policy Summary

| Table | Operation | Policy Enforcement |
|---|---|---|
| `profiles` | SELECT | Publicly readable so listing owners and claimants can be displayed |
| `profiles` | UPDATE | User can only update their own profile (`auth.uid() = id`) |
| `items` | SELECT | Approved items readable by anyone; unapproved items readable only by owner or moderator |
| `items` | INSERT | Authenticated users only, enforcing `owner_id = auth.uid()` |
| `items` | UPDATE | Owner (`auth.uid() = owner_id`) or moderator/admin |
| `items` | DELETE | Owner (`auth.uid() = owner_id`) or moderator/admin |
| `claims` | SELECT | Claimant (`auth.uid() = claimant_id`) OR Item Owner OR Moderator/Admin |
| `claims` | INSERT | Authenticated users only, on items they do NOT own |
| `claims` | UPDATE | Claimant, Item Owner, or Moderator/Admin |
| `reports` | INSERT | Authenticated users only (`reporter_id = auth.uid()`) |
| `reports` | SELECT | Reporter or Moderator/Admin |

---

## 3. Storage Bucket Configuration

- **Bucket Name**: `item-images`
- **Access**: Public read for approved listing photos
- **Upload Rule**: Authenticated users can upload JPEG, PNG, or WebP images under 5MB with paths prefixed by their user ID (`auth.uid()`).
