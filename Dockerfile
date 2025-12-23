FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to prepare the environment
USER root
WORKDIR /app

# Create cache directory and set initial permissions
RUN mkdir -p /app/.cache/puppeteer && chown -R pptruser:pptruser /app

# Copy dependency files AND set ownership to pptruser immediately
COPY --chown=pptruser:pptruser package*.json ./

# Switch to pptruser to perform the installation
USER pptruser

# Install dependencies (pptruser now has permission to modify the folder)
RUN npm install

# Copy the rest of the application files with correct ownership
COPY --chown=pptruser:pptruser . .

# Final environment settings
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
EXPOSE 8080

CMD ["node", "index.js"]