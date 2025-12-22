FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Crucial: This is where the official image actually keeps the binary
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

# Ensure the app directory is owned by the puppeteer user
RUN chown -R pptruser:pptruser /app

# Switch back to the image's default safe user
USER pptruser

EXPOSE 8080
CMD ["node", "index.js"]