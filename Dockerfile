# Start with the official PHP 8.2 CLI image
FROM php:8.2-cli

# Install core system dependencies, git, zip, and ALL required Playwright/Chromium dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # The specific glib library that previously caused the crash
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install Node.js (v20 LTS) and npm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Pre-install the Playwright Browsers globally so they don't have to be fetched on every run
RUN npx playwright install chromium

# Set the working directory to where you will mount your plugin
WORKDIR /app

