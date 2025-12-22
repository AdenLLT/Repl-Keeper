FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Crucial: This prevents the timeout/massive download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

# Ensure the pptruser has access to the app files
RUN chown -R pptruser:pptruser /app

# Use the pre-installed browser user
USER pptruser

EXPOSE 8080
CMD ["node", "index.js"]