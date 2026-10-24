# CampusFind Security Specification

## 1. Data Invariants

1. **Item Identity & Integrity**:
   - Items can only be created by an authenticated user where `request.auth.uid == incoming().ownerId`.
   - The `ownerId` cannot be changed by any update (`incoming().ownerId == existing().ownerId`).
   - The creation timestamp `createdAt` is immutable.
   - `updatedAt` must equal `request.time` on updates.
   - Only the item owner or an admin can update or delete an item listing.
   - Items with `moderationStatus == 'removed'` are hidden from public list queries.

2. **Claim Privacy & Access Control**:
   - Claims contain sensitive private proof details (`details`, `contactPhone`).
   - Claims can only be created by an authenticated user for an existing item document (`exists(/databases/$(database)/documents/items/$(incoming().itemId))`).
   - Claims can only be read (`get`) by the claimant who created it (`request.auth.uid == resource.data.claimantId`) or by the owner of the claimed item (`request.auth.uid == get(/databases/$(database)/documents/items/$(resource.data.itemId)).data.ownerId`), or by an admin.
   - Blanket query listing of all claims is forbidden (`allow list: if request.auth.uid == resource.data.claimantId || isAdmin()`).
   - Claim updates are restricted to authorized status transitions (`Pending`, `Under Review`, `Approved`, `Rejected`, `Completed`).

3. **Abuse Report Isolation**:
   - Reports can only be created by an authenticated user with `request.auth.uid == incoming().reporterId` targeting an existing item document.
   - Reports can only be read by the reporter or an administrator.

4. **User Profiles**:
   - User profile documents (`/users/{userId}`) can only be written by the user whose UID matches `{userId}`.
   - Non-admin users cannot elevate their own role (`role == 'student'`).

---

## 2. The "Dirty Dozen" Malicious Payloads

1. **Payload 1: Identity Spoofing on Item Creation**
   - *Attack*: Authenticated user Alice attempts to post an item with `ownerId: "bob_uid"`.
   - *Expected Result*: PERMISSION_DENIED.

2. **Payload 2: Anonymous Unauthenticated Listing Creation**
   - *Attack*: Unauthenticated visitor sends an item creation payload.
   - *Expected Result*: PERMISSION_DENIED.

3. **Payload 3: Unowned Item Status Hijacking**
   - *Attack*: Authenticated user Eve attempts to update the status of Alice's item from `Open` to `Recovered`.
   - *Expected Result*: PERMISSION_DENIED.

4. **Payload 4: Field Injection / Ghost Field in Item Document**
   - *Attack*: User posts an item with an extra unapproved field `isAdmin: true` or `verifiedBadge: true`.
   - *Expected Result*: PERMISSION_DENIED.

5. **Payload 5: Oversized String Injection (Denial of Wallet attack)**
   - *Attack*: User sends a 500KB string in `title` or `location`.
   - *Expected Result*: PERMISSION_DENIED (`title.size() <= 100`, `location.size() <= 150`).

6. **Payload 6: Unauthorized Reading of Private Claim Details**
   - *Attack*: Third-party user Charlie attempts to read Alice's claim verification details for Bob's found backpack.
   - *Expected Result*: PERMISSION_DENIED.

7. **Payload 7: Blanket Scraping of All User Claims**
   - *Attack*: Authenticated user queries `collection("claims")` without constraining to their own `claimantId`.
   - *Expected Result*: PERMISSION_DENIED.

8. **Payload 8: Orphaned Claim Creation**
   - *Attack*: User submits a claim referencing a non-existent `itemId: "ghost_item_999"`.
   - *Expected Result*: PERMISSION_DENIED (`exists` check fails).

9. **Payload 9: Self-Role Elevation in User Profile**
   - *Attack*: Regular student Alice writes `{ role: "admin" }` to `/users/alice_uid`.
   - *Expected Result*: PERMISSION_DENIED.

10. **Payload 10: Client-Forged Creation Timestamp**
    - *Attack*: User supplies a past or future timestamp string instead of server timestamp (`request.time`).
    - *Expected Result*: PERMISSION_DENIED.

11. **Payload 11: Deletion of Another User's Item Listing**
    - *Attack*: Attacker sends a DELETE request for another user's lost item document.
    - *Expected Result*: PERMISSION_DENIED.

12. **Payload 12: Terminal State Tampering on Claims**
    - *Attack*: Non-owner attempts to modify claim resolution details on an already completed/rejected claim.
    - *Expected Result*: PERMISSION_DENIED.
