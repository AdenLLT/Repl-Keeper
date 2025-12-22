FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Prevent the 30-minute timeout
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .

# This finds WHEREVER chrome is and creates a link to /usr/bin/chrome
RUN ln -s $(which google-chrome-stable || which google-chrome || which chromium) /usr/bin/chrome && chmod +x /usr/bin/chrome

EXPOSE 8080
CMD ["node", "index.js"]