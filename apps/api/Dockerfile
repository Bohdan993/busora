# Busora API image (also runs the demo's nightly reset).
#
# Built for amd64 and arm64. Puppeteer 10 (via html-pdf-node) has no prebuilt
# Chromium for arm64, so we skip its download and use the distro Chromium
# instead, pointing Puppeteer at it with PUPPETEER_EXECUTABLE_PATH (honored by
# Puppeteer 10 even though html-pdf-node doesn't pass executablePath).
# The app already launches Chromium with --no-sandbox, so running as root is fine.
FROM node:22-bookworm-slim

# Chromium + the fonts the Ukrainian/Cyrillic PDF tickets need.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-core \
      fonts-noto-cjk \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Some code paths / Puppeteer fallbacks look for the Ubuntu binary name
# (chromium-browser); symlink it to the Debian binary so either name works.
RUN ln -sf /usr/bin/chromium /usr/bin/chromium-browser

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Install deps first for better layer caching. Chromium download is already
# skipped via the env vars above, so puppeteer's postinstall is a no-op.
COPY package*.json ./
# Runtime deps only, plus sequelize-cli globally (the devDependency's version)
# so `npm run migrate`/`seed` work inside the container.
RUN npm ci --omit=dev && npm i -g sequelize-cli@6.6.2

# App source. assets/tickets and logs/ are overlaid by volumes at runtime so
# generated PDFs and log files persist across redeploys.
COPY . .

# Ensure the PDF/image output dirs exist. assets/tickets is empty in git (so
# not in the build context); without this the first (empty) named volume mount
# has no tickets/ dir and PDF writes fail with ENOENT. Docker seeds a fresh
# named volume from these dirs on first mount.
RUN mkdir -p /app/assets/tickets /app/assets/images /app/logs

EXPOSE 5000

# dumb-init reaps the zombie Chromium processes html-pdf-node spawns per PDF.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
