#!/bin/bash
# Start Xvfb with no auth file requirement
Xvfb :99 -screen 0 1920x1080x24 -ac &
XVFB_PID=$!
echo "Xvfb started with PID: $XVFB_PID"

# Wait for Xvfb to be ready
sleep 2

# Start VNC server for remote viewing with password
# Use VNC_PASSWORD env var or default to 'password'
VNC_PASS=${VNC_PASSWORD:-password}
mkdir -p /tmp
x11vnc -storepasswd "$VNC_PASS" /tmp/vncpasswd
x11vnc -display :99 -forever -rfbauth /tmp/vncpasswd -shared -rfbport 5900 -bg -o /tmp/x11vnc.log

# Start window manager
fluxbox &

# Wait for Next.js to be ready before opening browser
wait_for_app() {
  echo "Waiting for Next.js application to be ready..."
  for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
      echo "✅ Next.js application is ready!"
      return 0
    fi
    sleep 2
  done
  echo "⚠️  Timeout waiting for Next.js, but continuing..."
  return 1
}

# Start the application (use dev mode if build failed) in background
if [ -d ".next" ] && [ -f ".next/BUILD_ID" ]; then
  echo "Starting Next.js in production mode..."
  npm start &
else
  echo "No production build found, starting in dev mode..."
  npm run dev &
fi

APP_PID=$!

# Wait for application to be ready
wait_for_app

# Open default browser window in VNC so there's always something visible
echo "Opening default browser window in VNC..."
DISPLAY=:99 chromium \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  http://localhost:3000 \
  > /tmp/chromium.log 2>&1 &

echo "Default browser opened. VNC is ready to view!"

# Keep container alive by tailing the Next.js process logs
# Don't wait for the process, just keep the script alive
tail -f /dev/null
