FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Ensure the cache directory exists for the browser
RUN mkdir -p /app/.cache/puppeteer && chown -R pptruser:pptruser /app

COPY package*.json ./
# Switch to pptruser for the install so it populates the local cache
USER pptruser
RUN npm install

COPY --chown=pptruser:pptruser . .

EXPOSE 8080
CMD ["node", "index.js"]