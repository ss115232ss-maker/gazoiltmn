FROM node:18-alpine AS build

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npx prisma generate && npm run build
RUN cd frontend && npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=build /app/backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
