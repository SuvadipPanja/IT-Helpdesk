FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
  DB_SERVER=db

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p /app/uploads /app/logs /app/Data_Backup \
  && sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
