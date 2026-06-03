FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npx tsc -p tsconfig.json
# Compiler les scripts prisma séparément (ils sont hors rootDir)
RUN npx tsc --outDir prisma-compiled --module commonjs --target ES2021 \
    --esModuleInterop true --skipLibCheck true \
    prisma/seed.ts prisma/import-medicaments.ts

FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma-compiled/seed.js ./prisma/seed.js
COPY --from=builder /app/prisma-compiled/import-medicaments.js ./prisma/import-medicaments.js
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY prisma/ref-des-medicaments-cnops-2014.xlsx ./prisma/ref-des-medicaments-cnops-2014.xlsx

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node prisma/import-medicaments.js && node dist/main"]
