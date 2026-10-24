# CampusFind — Cloud-Synced Lost and Found Platform

**Tagline:** Lost something? Find it. Found something? Return it.

CampusFind is a full-stack, cloud-synchronized campus lost-and-found platform built with **React 19**, **TypeScript**, **Vite 8**, and **Supabase (PostgreSQL + Auth + Storage + Realtime)**.

It provides real authentication, cloud database persistence, image uploads, live multi-user synchronization, explainable matching algorithms, private claim verification, and abuse protection.

---

## 🚀 Key Features

- **🔐 Real User Authentication:** Email/password sign-up, login, session persistence, and profile management powered by Supabase Auth.
- **☁️ Cloud Database Persistence:** All items, claims, and abuse reports persist in a managed PostgreSQL database with Row Level Security (RLS).
- **📸 Real Image Uploads:** Attach item photos stored securely in Supabase Storage (`item-images` bucket) with thumbnail previews and size checks.
- **⚡ Live Realtime Synchronization:** When a user creates or updates a listing, other open sessions update instantly via WebSocket subscriptions.
- **🧠 Explainable Match Algorithm:** Weighted heuristic comparing category (30%), color (25%), location (20%), date proximity within 15 days (15%), and text keywords (10%) with transparent match scores and reasons.
- **🛡️ Private Ownership Verification:** Verification details submitted for found items are protected by RLS and visible only to the claimant and verified owner/reviewer.
- **🚩 Community Moderation & Flagging:** Built-in reporting mechanism to flag listings with sensitive private documents, spam, or abusive content.
- **🧪 Safe Development Seeding & Cleanup:** Dedicated developer tools (active in development mode) to seed realistic test records clearly labeled `[DEMO / TEST DATA]` and clean them up safely without touching real user submissions.
- **📱 Fully Responsive & Accessible:** Built with clean mobile navigation drawers, keyboard Escape key modal dismissal, and reduced-motion support.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Lucide React, Tailwind CSS / Custom Design Tokens
- **Backend & Database:** Supabase (PostgreSQL 15+, PostgREST, GoTrue Auth, Realtime, Storage)
- **Security:** PostgreSQL Row Level Security (RLS) policies
- **Bundler:** Vite 8
- **Testing:** Vitest, jsdom, @testing-library/react
- **Deployment:** Vercel / Cloudflare Pages / Static Hosting

---

## 🏁 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js 20+
- npm 10+
- A free [Supabase](https://supabase.com) account

### 2. Clone and Install
```bash
git clone https://github.com/mrpk01dav/campusfind-lost-and-found.git
cd campusfind-lost-and-found
npm install
```

### 3. Connect Supabase Cloud Database

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** in your Supabase dashboard and run the migration script:
   - Copy the SQL from `supabase/migrations/20261024000000_init_campusfind.sql`.
   - Paste and execute it in the SQL Editor. This provisions the `profiles`, `items`, `claims`, `reports`, and `notifications` tables, along with indexes, triggers, and Row Level Security policies.
3. In your Supabase dashboard, go to **Storage**:
   - Verify that the `item-images` bucket is created and marked as public. (The migration creates it automatically).
4. Go to **Project Settings** -> **API** and copy:
   - **Project URL**
   - **anon / public key**
5. Create a `.env` file in your project root:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

*Note: If you run the project without `.env` variables during development, it runs in a local sandbox mode for seamless initial testing.*

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Testing & Quality Assurance

Run the test suite:
```bash
npm test
```
Run type-checking:
```bash
npm run typecheck
```
Build for production:
```bash
npm run build
```

The automated test suite verifies:
- User authentication and session persistence.
- Real-time search and multi-criteria filtering.
- Domain match heuristic scoring and weight renormalization.
- Date boundary validation (rejecting future dates).
- Modal interactions, detail views, and ownership claim submission.
- Development seeding and test data cleanup without altering user listings.

---

## 🚀 Deployment (Vercel)

1. **Commit and Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: cloud-synced CampusFind with Supabase"
   git push origin main
   ```

2. **Import to Vercel:**
   - Log into [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
   - Select your `campusfind-lost-and-found` GitHub repository.

3. **Configure Environment Variables:**
   Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase publishable anon key

4. **Deploy:**
   - Click **Deploy**. Vercel will build and deploy the application.
   - SPA routing is pre-configured via `vercel.json`.

---

## 🔒 Security Architecture

- **Server-Enforced Ownership:** The backend uses `auth.uid()` from the verified JWT for all inserts, updates, and deletes.
- **Strict Row Level Security (RLS):** Prevents unauthorized users from reading private claim details or modifying others' items.
- **Zero Secret Exposure:** Never put your Supabase `service_role` secret in frontend code or repository commits.
- **Abuse Controls:** Text length restrictions, size-limited image uploads, and an administrative flagging workflow.

---

## 📄 License

MIT License — see LICENSE for details.
