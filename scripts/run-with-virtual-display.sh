#!/bin/bash

# Virtual Display Browser Runner
# This script runs the browser with virtual display capabilities

echo "🖥️  Starting Virtual Display Browser Setup..."

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📱 Detected macOS - Using headful browser for development"

    # On macOS, we'll run the browser in headful mode (visible)
    # This is useful for debugging and development
    export PUPPETEER_HEADLESS=false
    export DISPLAY_MODE=development

    echo "✅ Browser will run in visible mode"
    echo "💡 For true virtual display, use Docker: npm run docker:virtual-display"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Detected Linux - Setting up Xvfb virtual display"

    # Check if Xvfb is installed
    if ! command -v Xvfb &> /dev/null; then
        echo "❌ Xvfb not found. Installing..."
        sudo apt-get update && sudo apt-get install -y xvfb
    fi

    # Start Xvfb on display :99
    export DISPLAY=:99
    Xvfb :99 -screen 0 1920x1080x24 &
    XVFB_PID=$!

    echo "✅ Virtual display started on :99"
    echo "🔢 Xvfb PID: $XVFB_PID"

    # Save PID for cleanup
    echo $XVFB_PID > /tmp/xvfb.pid

    # Cleanup function
    cleanup() {
        echo "🧹 Cleaning up virtual display..."
        kill $XVFB_PID 2>/dev/null
        rm -f /tmp/xvfb.pid
    }
    trap cleanup EXIT
fi

# Export variables for the application
export VIRTUAL_DISPLAY=true
export BROWSER_VISIBLE=true

echo ""
echo "🚀 Starting application with virtual display support..."
echo "================================================"
echo ""

# Run the Next.js dev server
npm run dev
