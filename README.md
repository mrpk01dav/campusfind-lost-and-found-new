🎓 CampusFind — Campus Lost & Found Platform

Lost something? Find it. Found something? Return it.

CampusFind is a modern, full-stack lost-and-found platform designed to help students, faculty members, and campus communities reconnect people with their lost belongings.

Built with React 19, TypeScript, Vite 8, and Supabase, CampusFind combines secure authentication, cloud-based data storage, image uploads, real-time synchronization, intelligent item matching, and privacy-focused ownership verification in one responsive application.

Whether someone has lost a wallet, found a water bottle, misplaced a notebook, or discovered another student's belongings, CampusFind provides a structured way to report, discover, and recover items.

---

✨ Features at a Glance

Feature| Description
🔐 Authentication| Email/password registration, login, persistent sessions, and profile management through Supabase Auth.
☁️ Cloud Database| PostgreSQL-powered persistence for item listings, claims, reports, and notifications.
📸 Image Uploads| Upload item photos to Supabase Storage with file-size checks and image previews.
⚡ Real-Time Updates| Synchronize listing changes across connected sessions using Supabase Realtime.
🧠 Smart Matching| Explainable, weighted matching between lost and found items.
🔒 Private Claims| Protect ownership-verification details using database permissions and Row Level Security.
🚩 Community Reporting| Report suspicious listings, spam, abusive content, or exposed private documents.
🧪 Development Tools| Seed clearly labeled demo records and safely remove eligible test data in development mode.
📱 Responsive UI| Designed for mobile devices, tablets, and desktop screens.
♿ Accessibility| Keyboard-friendly modal dismissal, reduced-motion support, and accessible interaction patterns.

---

🛠️ Technology Stack

Frontend

- React 19
- TypeScript
- Vite 8
- Lucide React
- Tailwind CSS and/or custom design tokens

Backend and Cloud Services

- Supabase Auth
- PostgreSQL
- PostgREST
- Supabase Realtime
- Supabase Storage

Security

- PostgreSQL Row Level Security (RLS)
- Authenticated user identity through Supabase JWTs
- Database-enforced access policies
- Input validation and upload restrictions

Testing and Quality Assurance

- Vitest
- jsdom
- React Testing Library
- TypeScript type checking
- Production build verification

Deployment

- Vercel
- Cloudflare Pages
- Compatible static hosting providers

---

🧠 Intelligent Item Matching

CampusFind uses an explainable heuristic to estimate how closely a lost-item report matches a found-item listing.

The matching algorithm considers five criteria:

Matching criterion| Weight
Category| 30%
Color| 25%
Location| 20%
Date proximity| 15%
Text keywords| 10%
Total| 100%

How it works

1. Compare the category of the lost item with the found item.
2. Evaluate the similarity of their colors.
3. Compare the reported locations.
4. Consider how close the reported dates are, within a 15-day matching window.
5. Compare relevant text keywords and descriptions.
6. Calculate a weighted match score and provide reasons explaining the result.

The matching score is a suggestion, not proof of ownership. A high score does not guarantee that two reports concern the same physical item.

The application should use appropriate weight renormalization when some matching fields are missing, as supported by its matching implementation and tests.

---

🚀 Getting Started

Follow these instructions to run CampusFind locally.

Prerequisites

Install the following tools before starting:

- "Node.js" (https://nodejs.org/) — version 20 or later, subject to the requirements of your installed Vite version.
- npm 10 or later.
- A free "Supabase" (https://supabase.com/) account.
- Git.

1. Clone the Repository

git clone https://github.com/mrpk01dav/campusfind-lost-and-found.git
cd campusfind-lost-and-found

2. Install Dependencies

npm install

3. Create a Supabase Project

1. Open the "Supabase Dashboard" (https://supabase.com/dashboard).

2. Create a new project.

3. Wait for the database to finish provisioning.

4. Open the project's SQL Editor.

5. Locate the migration file in your repository:
   
   "supabase/migrations/20261024000000_init_campusfind.sql"

6. Review the SQL and execute the migration in your Supabase project.

The migration is intended to provision the database schema, indexes, triggers, storage configuration, and Row Level Security policies for the application.

Expected database entities include:

- "profiles"
- "items"
- "claims"
- "reports"
- "notifications"

Important: Confirm the migration's actual contents and successful execution before assuming every table, trigger, policy, or storage bucket has been created correctly.

4. Configure Environment Variables

In the root directory, create a file named ".env".

Add your Supabase project URL and public client key:

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

Replace the example values with the credentials shown in your Supabase project's API settings.

Depending on your Supabase project configuration, the publishable key may be labeled differently from the legacy "anon" key. Use the public client key supported by your application.

Security rules:

- Never place your Supabase "service_role" key or another privileged secret in frontend code.
- Never commit real credentials to Git.
- Add ".env" to ".gitignore".
- Configure production environment variables separately in your hosting provider.
- Treat every value prefixed with "VITE_" as potentially visible to users in the browser.

The public client key is not a replacement for database security. Correct Row Level Security policies are essential.

5. Start the Development Server

npm run dev

Open the local URL printed by Vite in your terminal.

The project documentation specifies "http://localhost:3000"; use that address if your Vite configuration sets port 3000. Otherwise, use the URL displayed by the development server.

6. Local Development Without Supabase

The project is documented as supporting a local sandbox mode when Supabase environment variables are absent.

In this mode, verify which functionality is actually available. Local sandbox data should not be assumed to provide real authentication, cloud persistence, cross-device synchronization, or production-grade claim privacy.

---

🗄️ Database and Storage

Database

Supabase PostgreSQL stores application records, including item listings and ownership claims.

The intended schema includes:

- Profiles: User-related profile information.
- Items: Lost and found listings, descriptions, categories, dates, locations, and image references.
- Claims: Ownership-claim submissions and verification information.
- Reports: Community-submitted abuse or safety reports.
- Notifications: Application notification records.

Database constraints, indexes, triggers, and policies should be reviewed to confirm that the actual implementation matches these intended responsibilities.

Image Storage

CampusFind uses a Supabase Storage bucket named:

"item-images"

The setup instructions describe this bucket as public. Before enabling public access, evaluate whether item photographs could expose sensitive information.

A public bucket generally allows anyone with access to an object's public URL to retrieve it. Row Level Security on database tables does not make public image files private.

Recommended precautions:

- Reject unsupported file types.
- Enforce upload size limits on the server or storage policy, not only in the UI.
- Avoid uploading identity documents, financial information, or other sensitive records.
- Consider a private bucket and short-lived signed URLs when appropriate.
- Ensure upload, update, and delete permissions are restricted to authorized users.

---

🔐 Security and Privacy

CampusFind is designed around protecting user data and preventing unauthorized changes.

Authentication

Supabase Auth handles user registration, login, and session management. Authentication identifies a user, but authorization must still be enforced separately.

Row Level Security

RLS policies should ensure that users can access only the records and operations permitted by the application's privacy model.

In particular:

- Users must not modify or delete another user's listings without authorization.
- Claim verification details must not be exposed to unrelated users.
- Users must not impersonate other users by supplying arbitrary user IDs.
- Reports and moderation records must be accessible only to appropriately authorized roles.
- Database operations must use the authenticated identity supplied by the verified session rather than trusting client-provided ownership fields.

Abuse Prevention

The platform includes a reporting workflow intended to help identify:

- Spam or misleading listings.
- Abusive content.
- Listings containing exposed private documents.
- Potentially fraudulent claims.

Text-length checks and client-side upload validation improve usability, but they must be backed by server-side validation, appropriate database constraints, and storage policies.

Security Verification Checklist

Before production deployment, verify:

- [ ] RLS is enabled on every table containing user or claim data.
- [ ] Policies cover "SELECT", "INSERT", "UPDATE", and "DELETE" as applicable.
- [ ] Claim details are inaccessible to unauthorized users.
- [ ] Users cannot assign listings or claims to another account by changing request data.
- [ ] Storage upload and deletion permissions are appropriately restricted.
- [ ] Public image access is an intentional decision.
- [ ] Administrative moderation privileges are enforced by trusted backend authorization.
- [ ] No privileged secrets are exposed in the frontend bundle.
- [ ] Authentication, session expiry, and logout are tested.
- [ ] Database policies are tested using separate user accounts.

---

🧪 Development Seeding and Test Data

CampusFind provides development-oriented tools for generating realistic sample records and cleaning up test data.

Demo records should be clearly labeled:

"[DEMO / TEST DATA]"

These tools are intended to help developers test listing discovery, filtering, matching, claims, and moderation without mixing sample records with genuine user submissions.

Safe Usage Guidelines

- Keep seeding and cleanup controls disabled in production.
- Ensure demo records are distinguishable from real submissions.
- Restrict cleanup operations to explicitly identified test records.
- Never delete records merely because their descriptions resemble sample data.
- Test cleanup against a disposable development database first.
- Verify that cleanup cannot affect real listings, claims, reports, or notifications.

Development-only UI controls are not sufficient protection on their own. Any destructive database operation must also have appropriate authorization and narrowly scoped database logic.

---

✅ Testing and Quality Assurance

Run the following commands from the project root.

Run Tests

npm test

Run Type Checking

npm run typecheck

Build for Production

npm run build

The commands above assume the corresponding scripts are defined in "package.json".

Test Coverage Goals

The documented test suite is intended to cover the following areas:

- Authentication and session persistence.
- Search, filtering, and listing discovery.
- Matching scores, explanations, and weight renormalization.
- Date validation, including rejection of future dates where required.
- Modal interactions and item detail views.
- Ownership-claim submission.
- Development seeding and cleanup safety.

For production readiness, also test database RLS policies, file upload restrictions, realtime subscriptions, network failures, duplicate submissions, session expiry, and concurrent updates against a real test Supabase project.

Note: A passing frontend test suite does not independently prove that cloud authorization or database security is correct.

---

🌐 Deployment Guide — Vercel

1. Push the Project to GitHub

If the repository is already initialized and connected to GitHub, commit and push your changes:

git add .
git commit -m "docs: improve CampusFind README"
git push origin main

Ensure ".env" and other secret files are excluded from version control before pushing.

2. Import the Repository into Vercel

1. Open "Vercel" (https://vercel.com/).
2. Sign in and select Add New → Project.
3. Import the "campusfind-lost-and-found" repository.
4. Confirm the framework and build configuration.

Typical settings for a Vite project are:

Setting| Value
Framework| Vite
Build command| "npm run build"
Output directory| "dist"
Install command| "npm install"

Adjust these settings if the repository defines different build commands or output paths.

3. Configure Production Environment Variables

In the Vercel project settings, add:

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

Use the correct public client key for your Supabase project.

4. Configure SPA Routing

If the application uses client-side routing, verify that "vercel.json" or the hosting configuration correctly directs application routes to the SPA entry point.

The repository is described as having a "vercel.json" configuration. Check that the file exists and that its rules do not interfere with API requests or static assets.

5. Deploy and Verify

Deploy the project and test the production URL.

Verify:

- User registration, login, and logout.
- Session persistence after refreshing the page.
- Creating and updating listings.
- Image upload and retrieval.
- Search and matching.
- Claim submission and private verification.
- Reporting and moderation.
- Real-time updates in two separate browser sessions.
- Mobile layout and keyboard accessibility.
- Error handling when the network or Supabase service is unavailable.

---

📁 Project Structure

The following is an illustrative overview of the expected repository organization. Actual filenames and folders may differ.

campusfind-lost-and-found/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   └── ...
├── supabase/
│   └── migrations/
│       └── 20261024000000_init_campusfind.sql
├── tests/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json
└── README.md

This structure is provided as a guide, not a verified inventory of the repository. Preserve the project's real directory structure when updating documentation.

---

🗺️ Future Improvements

Potential improvements for future versions include:

- Email verification and password-reset workflows.
- Advanced search by campus building, date, category, and item attributes.
- Optional email or push notifications for likely matches.
- Private image storage and expiring signed URLs.
- An authorized moderation dashboard.
- Rate limiting and stronger anti-spam protections.
- Audit logs for sensitive claim and moderation actions.
- Improved automated security and end-to-end tests.
- Campus-specific configuration and verified campus domains.
- Installation support as a Progressive Web App, if implemented.

These are roadmap ideas rather than claims that the features already exist.

---

🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes.
4. Run the available tests and production build.
5. Submit a pull request describing the changes.

For security-sensitive issues, avoid posting credentials, private claim details, or exploitable vulnerabilities in public issue reports.

---

📜 License

CampusFind is described as being distributed under the MIT License.

See the repository's "LICENSE" file for the applicable terms.

---

💙 Project Vision

CampusFind aims to make campus lost-and-found systems more accessible, transparent, and reliable by bringing students and campus communities together through a shared digital platform.

Lost something? Find it. Found something? Return it.

Built to help lost belongings find their way home.
