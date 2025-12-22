FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Ensure pptruser owns the directory before switching
COPY package*.json ./
RUN chown -R pptruser:pptruser /app

USER pptruser

# Skip the download because the image already has it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm install
COPY --chown=pptruser:pptruser . .

EXPOSE 8080
CMD ["node", "index.js"]