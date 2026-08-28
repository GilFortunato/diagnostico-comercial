# Share AI Foundation

This MVP starts with a modular monolith for Vercel and Next.js App Router.

## Core Decisions

- Next.js + TypeScript provide the app, API routes, and server-side orchestration.
- PostgreSQL/Neon is the system of record. `prisma/schema.prisma` defines the initial data model.
- Google login and Gemini authorization are separate concepts. Login uses Auth.js; Gemini is a connector credential owned by the user or organization.
- Skills depend on capabilities such as `ai.generateStructuredAssessment` and `research.publicBusinessProfile`, not vendor names.
- Credentials are handled only by backend code and represented by encrypted payloads.
- Human approval is modeled before any external action such as publishing, sending messages, CRM updates, or third-party automations.

## Current Adapter State

The repository includes a demo repository adapter for local MVP flow while Neon credentials are not configured. It is intentionally marked as `demo-local` in UI/API responses. The Prisma schema is the contract for replacing this with a real database repository.

## First Functional Flow

`Authority Assessment` evaluates commercial authority, not employability. It accepts a LinkedIn profile/context, BU, goals, themes, evidence, and activity signals. It returns:

- score 0-100;
- dimension scores;
- strengths and gaps;
- risks and opportunities;
- recommendations;
- 30-day plan;
- sources and confidence;
- history and evolution comparison.

## Environment Variables

Required for production:

- `DATABASE_URL`: Neon/PostgreSQL connection string.
- `NEXTAUTH_SECRET`: Auth.js signing secret.
- `GOOGLE_CLIENT_ID`: Google OAuth client id.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `CREDENTIAL_ENCRYPTION_KEY`: 32-byte base64 key for connector credentials.

Optional until Gemini is connected:

- `DEFAULT_AI_PROVIDER`: provider key, for example `gemini`.
