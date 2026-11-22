# The processing server: Node plus the programs the tools run.
# Deploy this on a container host (Railway, Render, Fly.io, a VPS…). Vercel cannot run it.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ghostscript poppler-utils p7zip-full zip \
      libreoffice-writer libreoffice-calc libreoffice-impress \
      chromium fontconfig fonts-noto-core fonts-noto-color-emoji fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    CHROME_BIN=/usr/bin/chromium \
    FILEKIT_DATA_DIR=/data
# Set these on the host:
#   ALLOWED_ORIGINS=https://your-site.vercel.app,https://thefilekit.com   (the website's address)
#   SITE_URL=https://thefilekit.com                                       (only if this server also serves the pages)
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
