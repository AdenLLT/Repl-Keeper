FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# THIS IS THE FIX: It stops the 300MB download that causes the timeout
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "index.js"]