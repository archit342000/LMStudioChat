#!/bin/bash
set -e

# Export display port for X11
export DISPLAY=:99

# Clean up any stale lock files
rm -f /tmp/.X99-lock
rm -f /tmp/.X11-unix/X99

# Clean up stale Chromium SingletonLock files from persistent profiles.
# These are symlinks referencing old container hostnames that prevent Chromium
# from starting after a container is recreated (new hostname).
echo "Cleaning stale Chromium profile locks..."
for profile_dir in /app/playwright_data/portal_profile /app/playwright_data/default_profile; do
    rm -f "$profile_dir/SingletonLock" "$profile_dir/SingletonCookie" "$profile_dir/SingletonSocket" 2>/dev/null
done

# Start Virtual Framebuffer with access control disabled
echo "Starting Xvfb on DISPLAY=:99..."
Xvfb :99 -screen 0 1920x1080x24 -ac &

# Wait for the X server to be ready
echo "Waiting for X server to start..."
timeout 10 bash -c 'while ! xdpyinfo -display :99 >/dev/null 2>&1; do sleep 0.5; done' || { echo "Xvfb failed to start!"; exit 1; }

# Start Window Manager (prevents browser from acting like a kiosk and failing to handle popups)
echo "Starting Fluxbox..."
fluxbox &
sleep 1

# Start VNC Server
echo "Starting x11vnc..."
x11vnc -display :99 -forever -nopw -bg -quiet -xkb

# Start Websockify bridge for noVNC
echo "Starting websockify for noVNC on port 6080..."
websockify --web /usr/share/novnc 6080 localhost:5900 &

# Start the MCP Python Server
echo "Starting Playwright MCP Server..."
exec python3 -m playwright_mcp.server