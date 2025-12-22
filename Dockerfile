FROM ghcr.io/puppeteer/puppeteer:latest

# Use the working directory
WORKDIR /app

# Ensure we don't try to download a second chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Set the path variable so the system finds it
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

COPY package*.json ./
RUN npm install
COPY . .

# We use the default 'pptruser' that comes with the image for safety
EXPOSE 8080
CMD ["node", "index.js"]