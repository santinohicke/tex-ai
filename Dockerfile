FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3050
ENV HOSTNAME="0.0.0.0"

# Copiar bundle standalone precompilado
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY data ./data

EXPOSE 3050

CMD ["node", "server.js"]
