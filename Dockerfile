FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Stop the massive download to prevent 30-min timeout
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

# Force permissions so the script can execute the browser
RUN chmod +x /usr/bin/google-chrome-stable

EXPOSE 8080
CMD ["node", "index.js"]