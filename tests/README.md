# Graph RAG Onboarding Test Scripts

These are lightweight manual integration scripts for the onboarding and graph recommendation flows.

## Prerequisites

- App running locally (`pnpm dev`) on `http://localhost:3000` (or set `APP_ORIGIN`)
- For authenticated tests, export a valid Better Auth cookie header value in `AUTH_COOKIE`

Example cookie format:

```bash
export AUTH_COOKIE='better-auth.session_token=YOUR_TOKEN_HERE'
```

## Run Scripts

```bash
APP_ORIGIN=http://localhost:3000 npx tsx tests/onboarding-redirect.test.tsx
APP_ORIGIN=http://localhost:3000 AUTH_COOKIE="$AUTH_COOKIE" npx tsx tests/preferences-save.test.tsx
APP_ORIGIN=http://localhost:3000 AUTH_COOKIE="$AUTH_COOKIE" npx tsx tests/graph-recommendations-auth.test.tsx
APP_ORIGIN=http://localhost:3000 AUTH_COOKIE="$AUTH_COOKIE" npx tsx tests/recommendations-fallback.test.tsx
```

## Expected Outcomes

- `onboarding-redirect.test.tsx`: returns redirect (`3xx`) to `/login` when unauthenticated.
- `preferences-save.test.tsx`: returns `{ success: true }`.
- `graph-recommendations-auth.test.tsx`: returns non-empty `recommendations` array.
- `recommendations-fallback.test.tsx`: returns non-empty `recommendations` array for unknown user id via fallback logic.
