FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Prevent the 30-minute timeout
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "index.js"]