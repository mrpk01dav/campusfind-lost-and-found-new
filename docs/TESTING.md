# Testing

Run `npm run typecheck`, `npm test`, and `npm run build`. The test suite focuses on pure domain logic (validation, search, match score and missing data). Manual QA should cover phone/tablet/desktop widths, keyboard focus, form errors, localStorage persistence, empty results, date boundaries, and interrupted browser storage.

Not yet covered: end-to-end browser flows, real authentication, backend authorization, cloud persistence, file upload, offline/network failure, or deployed security rules. These are unimplemented rather than passed.
