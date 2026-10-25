FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./

# Reproducible install from package-lock.json. The prisma CLI is a devDependency
# and is needed at container start for `prisma migrate deploy`, so dev deps are kept.
RUN npm ci

COPY . .

# `prisma db push` used to generate the client implicitly at start-up; `migrate deploy`
# does not, so generate it at build time.
RUN npx prisma generate

# Run as the unprivileged "node" user that ships with the base image.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Apply committed migrations (fails loudly on a bad/destructive migration), then start.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
