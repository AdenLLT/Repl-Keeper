FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Tell npm and Puppeteer NOT to download Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --chown=pptruser:pptruser package*.json ./

USER pptruser
RUN npm install --only=production

COPY --chown=pptruser:pptruser . .

EXPOSE 8080
CMD ["node", "index.js"]