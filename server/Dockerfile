FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./

# Reproducible install from package-lock.json. The prisma CLI is a devDependency
# and is needed at container start for `prisma db push`, so dev deps are kept.
RUN npm ci

COPY . .

# Generate the Prisma client at build time rather than at start-up.
RUN npx prisma generate

# Run as the unprivileged "node" user that ships with the base image.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Sync the schema on every start (as before), then start. NOTE: --accept-data-loss means a
# schema change that drops a column/table will silently drop its data. Switch back to
# `prisma migrate deploy` (see prisma/migrations/README.md) once migrations are baselined.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
