# @madstoq/database

Prisma ORM + Supabase client for the MADSTOQ platform.

## Supabase connection strings

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **Database**.
2. Copy **Transaction** pooler URI → `DATABASE_URL` (port 6543, `?pgbouncer=true`).
3. Copy **Session** or **Direct** URI → `DIRECT_URL` (port 5432) for migrations.

Place both in repo root `.env` and `database/.env`.

## Commands

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:migrate:dev # Apply migrations (uses DIRECT_URL)
pnpm db:seed        # Seed default client + demo inventory
pnpm db:studio      # Prisma Studio
```
