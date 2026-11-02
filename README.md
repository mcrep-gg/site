# mcrep.gg website

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, Drizzle ORM.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts a local Postgres (PGlite, data in `.data/pglite`) on `127.0.0.1:54329`, applies migrations, then starts Next. Nothing else needs installing. PGlite corrupts its files if two processes open them, so only that server touches `.data/pglite`; everything else connects over `DATABASE_URL`.

To run `npm run db:migrate` or other scripts while the dev server is up, point them at it:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres npm run db:migrate
```

In production, set `DATABASE_URL` to a real Postgres.

### Signing in locally

There is no Link Server in development. Get a Link Code for any Java Edition username, then enter it at `/sign-in`:

```
http://localhost:3000/api/dev/link-code?username=Notch
```

This route only exists when `NODE_ENV` is `development`.

### Ranks: Admin, Staff and Pro

- **Admin**: the Players whose UUIDs are listed in `ADMIN_UUIDS` (comma-separated). It can't be given or taken away from the site.
- **Staff**: given by an Admin. Can use `/admin` like an Admin (the Report queue, Player moderation: remove any +1/−1, suspend or lift a Suspension, and the Reputation activity log), but can't give out ranks.
- **Pro**: given by an Admin, for donators. Only a badge for now.

Each rank shows a badge on the Player's profile, next to their name on Reputation they gave, on the leaderboard and on their Settings page. Admins and Staff get an Admin link in the account menu; everyone else gets a 404 at `/admin`. Admins give and take away Staff and Pro from the Rank panel on a Player's admin page, and `/admin/ranks` lists everyone with a rank. Admins and Staff can't be suspended.

## Layout

- `src/lib/rules.ts`: the Reputation rules (one +1/−1 per pair, reasons, daily limits). Pure and unit-tested.
- `src/server/`: database operations (`reputation.ts`, `auth.ts`, `players.ts`, `admin.ts`, `ranks.ts`). Each takes the `db` as a parameter so tests run against an in-memory Postgres.
- `src/db/`: Drizzle schema and connection. `npm run db:generate` writes a new migration to `drizzle/` after a schema change.
- `src/app/`: pages, Server Actions and route handlers.

## APIs

- `POST /api/link-codes`: Link Server only. `Authorization: Bearer $LINK_SERVER_SECRET`, body `{ "uuid", "username" }`, returns `{ "code", "expiresAt" }`.
- `GET /api/v1/players/{uuid}`: public, read-only Reputation for the plugin: `{ uuid, username, positive, negative, net }`.

## Tests

```bash
npm test
```
