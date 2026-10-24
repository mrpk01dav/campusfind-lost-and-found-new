# Contributing

1. Fork the repository on GitHub and clone your fork: `git clone <your-fork-url>`.
2. Create a focused branch: `git switch -c feat/short-description`.
3. Install dependencies with `npm install` and start the app with `npm run dev`.
4. Keep TypeScript strict, use reusable components, accessible labels, and visible loading/error/empty states. Avoid adding dependencies without a clear need.
5. Before opening a pull request, run `npm run typecheck`, `npm test`, and `npm run build`.
6. Describe the problem, changes, tests run, and any limitations in your pull request. Add genuine screenshots for UI changes.
7. Never commit `.env`, credentials, real claims, private documents, production exports, or other personal data.

For security-sensitive changes, explain the server-side authorization and privacy implications; UI-only checks are not authorization.
