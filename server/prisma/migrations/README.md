# Prisma migrations

`20261025000000_baseline` recreates the schema as it existed when migrations were
introduced. Production was originally created with `prisma db push`, so its tables
already exist and the baseline must NOT be executed there, only recorded as applied.

## One-time production step (before the first deploy with the new CMD)

The container now starts with `npx prisma migrate deploy && npm start`. On a database
with no `_prisma_migrations` history, `migrate deploy` would try to run the baseline
`CREATE TABLE` statements and fail. Mark the baseline as applied first, against the
PRODUCTION database:

```sh
cd server
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?schema=public" \
  npx prisma migrate resolve --applied 20261025000000_baseline
```

(or run the same command in a one-off container of the new image on the prod network).
Take a pg_dump backup first. Fresh databases (local, CI) need nothing: `migrate deploy`
runs the baseline normally.

## Schema changes after the baseline

Any schema.prisma change (for example new columns) needs its own migration, generated in
development with `npx prisma migrate dev --name <change>` and committed. Verify the
baseline matches the live prod schema (`prisma migrate diff --from-url <prod> --to-schema-datamodel prisma/schema.prisma`)
before running `resolve`.
