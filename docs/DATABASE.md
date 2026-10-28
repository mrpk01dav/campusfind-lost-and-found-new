# CampusFind Cloud Database Architecture (Firebase Cloud Firestore)

CampusFind uses Google Cloud Firestore with Granular Security Rules (`firestore.rules`) to enforce security boundaries, authenticated listing ownership, private claim verification, and tamper-proof reward tracking.

---

## 1. Firestore Collections Overview

### `users/{userId}`
Stores user profile information keyed to the authenticated user's UID (`request.auth.uid`).
- `id` (String): Authenticated user UID.
- `displayName` (String, 2–100 chars): Student or staff name.
- `email` (String): Authenticated email address.
- `avatarUrl` (String, optional): Optional base64 or storage URL.
- `phoneNumber` (String, optional): Optional contact number for safe handover coordination.
- `department` (String, optional): Major, department, or campus office.
- `preferredContactMethod` (Enum): `'email' | 'phone' | 'in_person'`.
- `notificationPreferences` (Map): Notification toggles (`emailMatches`, `claimUpdates`, `newClaimsReceived`).
- `rewardsOptIn` (Boolean): User opt-in to public community recognition.
- `role` (Enum): `'student' | 'staff' | 'moderator' | 'admin'`. Clients can only set `'student' | 'staff'`.
- `createdAt` / `updatedAt` (Timestamp): Server timestamps.

### `items/{itemId}`
Stores lost and found listings submitted by authenticated users.
- `id` (String): Document ID (UUID or alphanumeric).
- `type` (Enum): `'lost' | 'found'`.
- `title` (String, 3–100 chars): Title of misplaced or discovered item.
- `category` (String): Electronics, ID & Cards, Books & Notes, Keys, Bags, etc.
- `description` (String, 5–2000 chars): Detailed visible features.
- `color` (String, optional): Distinctive color or markings.
- `location` (String, 2–150 chars): Campus building or room.
- `date` (String, YYYY-MM-DD): Date lost or found (cannot be in the future).
- `time` (String, optional): Approximate time.
- `imageUrl` (String, max 1MB): Base64 photo representation.
- `handover` (Boolean): Whether item is deposited at campus security.
- `status` (Enum): `'Open' | 'Possible Match' | 'Claim Pending' | 'Recovered' | 'Closed'`.
- `ownerId` (String): UID of creator.
- `ownerName` (String): Creator's display name.
- `isDemo` (Boolean): Flags seed records for safe development clean-up.
- `moderationStatus` (Enum): `'pending' | 'approved' | 'flagged' | 'rejected' | 'removed'`.
- `createdAt` / `updatedAt` (Timestamp): Server timestamps.

### `claims/{claimId}`
Confidential ownership verification claims submitted against found listings.
- `id` (String): Claim Document ID.
- `itemId` (String): References target item in `/items/{itemId}`.
- `itemTitle` (String, optional): Title of target item.
- `itemOwnerId` (String, optional): UID of finder who reported the item.
- `claimantId` (String): UID of claimant.
- `claimantName` (String): Claimant's name.
- `claimantEmail` (String, optional): Email for handover coordination.
- `contactPhone` (String, optional): Phone for handover coordination.
- `details` (String, 10–1500 chars): Private proof/identifying features.
- `evidenceUrl` (String, optional): Base64 image proof of ownership.
- `status` (Enum): `'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed'`.
- `reviewerId` (String, optional): UID of finder or staff reviewer.
- `reviewerName` (String, optional): Reviewer display name.
- `resolutionNote` (String, optional): Reviewer instructions.
- `returnConfirmedAt` (Timestamp, optional): Timestamp when handover completed.
- `returnConfirmedBy` (String, optional): Reviewer who confirmed return.
- `createdAt` / `updatedAt` (Timestamp): Server timestamps.

### `notifications/{notificationId}`
In-app alerts for match notifications and claim status updates.
- `id` (String): Notification Document ID.
- `recipientId` (String): UID of user receiving the notification.
- `senderId` (String): UID of sender.
- `senderName` (String, optional): Sender name.
- `type` (Enum): `'match_alert' | 'claim_submitted' | 'claim_approved' | 'claim_rejected' | 'evidence_requested' | 'handover_completed'`.
- `title` (String, max 120 chars): Short notification summary.
- `message` (String, max 1000 chars): Notification body.
- `itemId` (String): Target item ID.
- `itemTitle` (String, optional): Target item title.
- `foundItemId` (String, optional): Matching found item ID for match alerts.
- `claimId` (String, optional): Associated claim ID.
- `read` (Boolean): Read state indicator.
- `createdAt` (Timestamp): Server timestamp.

### `rewards/{rewardId}`
Immutable audit ledger for verified community honesty points.
- `id` (String): Transaction ID.
- `userId` (String): UID of honest finder.
- `action` (Enum): `'item_returned' | 'found_item_verified' | 'match_assisted'`.
- `points` (Integer, 1–500): Verified reward points (+50 on confirmed handover).
- `targetId` (String): ID of item returned or assisted.
- `targetTitle` (String, optional): Item name.
- `description` (String): Verified action summary.
- `createdAt` (Timestamp): Server timestamp.

### `admins/{adminUid}`
Trusted collection of authorized administrative accounts. Clients have no write access to this collection.
