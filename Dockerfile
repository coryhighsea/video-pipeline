FROM oven/bun:1.2

WORKDIR /app

# System dependencies:
# - ffmpeg: video processing
# - git, cmake, build-essential: whisper.cpp compilation (runs on first analyze, stored in volume)
# - chromium + deps: Remotion rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    cmake \
    build-essential \
    ca-certificates \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

# Install root dependencies (Remotion + React)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Install server dependencies
COPY server/package.json server/bun.lock ./server/
RUN cd server && bun install --frozen-lockfile

# Copy source
COPY . .

# Create runtime directories (volumes will mount over these, but they need to exist)
RUN mkdir -p /app/uploads /app/public /app/out /app/tmp /app/whisper.cpp

EXPOSE 3030

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
