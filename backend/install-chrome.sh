#!/bin/bash

# Install Chrome for Render.com
echo "========================================="
echo "Installing Google Chrome for Puppeteer..."
echo "========================================="

# Update packages
apt-get update

# Install dependencies
apt-get install -y wget gnupg ca-certificates

# Add Google Chrome repository
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list

# Update and install Chrome
apt-get update
apt-get install -y google-chrome-stable

# Verify installation
if [ -f "/usr/bin/google-chrome-stable" ]; then
    echo "✅ Chrome installed successfully at: /usr/bin/google-chrome-stable"
    ls -la /usr/bin/google-chrome-stable
else
    echo "❌ Chrome installation failed!"
    exit 1
fi

echo "========================================="
echo "Chrome installation completed!"
echo "========================================="