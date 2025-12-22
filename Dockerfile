FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Ensure the binary is exactly where we expect it
RUN ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome

COPY package*.json ./
RUN npm install
COPY . .

RUN chown -R pptruser:pptruser /app
USER pptruser

EXPOSE 8080
CMD ["node", "index.js"]