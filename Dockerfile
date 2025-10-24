# Use Node.js 20 as base image
FROM node:20-slim

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for Next.js build)
RUN npm ci

# Copy application code
COPY . .

# Build arguments for Next.js public env vars
ARG NEXT_PUBLIC_WORKFLOW_ID
ARG NEXT_PUBLIC_CHATKIT_DOMAIN_KEY
ENV NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID
ENV NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY

# Build the Next.js application with increased memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Note: NOT removing devDependencies because next.config.ts requires TypeScript at runtime

# Expose port 8080 (required by Cloud Run)
EXPOSE 8080

# Set NODE_ENV to production
ENV NODE_ENV=production \
    PORT=8080

# Start the application
CMD ["npm", "start"]
