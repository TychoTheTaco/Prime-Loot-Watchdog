FROM node:18-slim

# Install Chromium
RUN apt-get update && apt-get install chromium -y

# Copy required files
WORKDIR /app
COPY ./src ./src
COPY package*.json ./
COPY tsconfig.json ./

# Don't download the bundled Chromium with Puppeteer (We will use a stanalone Chromium instead)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install node packages
RUN npm install

# Compile the app
RUN npm run compile

WORKDIR /app/data

# Start the app
ENTRYPOINT ["node", "/app/dist/index.js"]
