FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to handle setup and permissions
USER root

WORKDIR /app

# Prevent Puppeteer from trying to download another browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy dependency files
COPY package*.json ./

# Fix permissions so 'pptruser' can run npm install
RUN chown -R pptruser:pptruser /app

# Switch to the image's default user
USER pptruser

# Now install dependencies as the pptruser
RUN npm install

# Copy the rest of your code
COPY --chown=pptruser:pptruser . .

EXPOSE 8080

CMD ["node", "index.js"]