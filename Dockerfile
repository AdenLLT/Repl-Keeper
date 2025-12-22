FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install
COPY . .

# Ensure permissions are wide open for the binary folder
RUN chmod -R 755 /usr/bin/

USER pptruser

EXPOSE 8080
CMD ["node", "index.js"]