# CampusFind Architecture & Cloud Synchronization

CampusFind is architected as a modern, full-stack reactive single-page application built on React 19, TypeScript, Vite, and Supabase Cloud (PostgreSQL + Auth + Storage + Realtime).

---

## 1. Architecture Diagram & Data Flow

```
[Browser / Client (React 19)]
       │
       ├──► Supabase Auth (JWT session management, sign in, sign up, role assignment)
       │
       ├──► Supabase Storage (`item-images` bucket, public read / auth write)
       │
       ├──► PostgreSQL via PostgREST (Row Level Security enforcement)
       │         │
       │         ├── profiles
       │         ├── items (Lost & Found reports)
       │         ├── claims (Private ownership checks)
       │         ├── reports (Abuse / flagging)
       │         └── notifications
       │
       └──◄ Supabase Realtime (WebSocket postgres_changes subscription for live updates)
```

---

## 2. Core Modules

- **`src/domain.ts`**: Pure domain types, business rules, matching heuristic algorithm (weighted similarity across category, color, location, date proximity, text), and input validators.
- **`src/lib/supabase.ts`**: Central client configuration with dual-mode support (live Supabase cloud connection when configured, and a seamless local test adapter for offline sandbox testing).
- **`src/services/authService.ts`**: Authentication lifecycle, registration, login, logout, password reset, and auth state listeners.
- **`src/services/itemService.ts`**: Database CRUD operations, image storage upload, dev data seeding and cleanup, and real-time item subscription.
- **`src/services/claimService.ts`**: Verified claim submission, status transitions, and real-time claim subscription.
- **`src/services/reportService.ts`**: Community flagging and abuse reporting.
- **`src/ui.tsx`**: Unified user interface, accessible modal dialogs, mobile navigation drawer, and reactive state management.
- **`supabase/migrations/`**: Documented SQL migrations, indexes, triggers, and Row Level Security policies.

---

## 3. Realtime Cloud Synchronization

- The client subscribes to Postgres changes on `public:items` and `public:claims`.
- When an item is created, edited, marked recovered, or deleted on any device, all connected clients receive the change in real-time without requiring manual page reload.
- Subscriptions are gracefully cleaned up on component unmount to prevent memory leaks.
