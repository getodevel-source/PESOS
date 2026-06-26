#!/bin/bash

# Configuration
PORT=3000
URL="http://localhost:$PORT"
SERVICE_NAME="vida-server.service"
APP_DIR="/home/geto/Proyectos/VIDA"
PROFILE_DIR="/home/geto/.config/pesos-profile"

# Function to send desktop notification
notify() {
    if command -v notify-send >/dev/null; then
        notify-send -a "Pesos" -i "/home/geto/.local/share/applications/icons/Pesos.png" "$1" "$2"
    fi
}

# Stop server action
if [ "$1" = "--stop" ]; then
    echo "Stopping Vida OS systemd service..."
    systemctl --user stop "$SERVICE_NAME"
    
    echo "Stopping Supabase database containers..."
    cd "$APP_DIR" || exit 1
    npx supabase stop >/dev/null 2>&1
    
    notify "Pesos" "Servicios y base de datos detenidos."
    echo "All services stopped."
    exit 0
fi

# 1. Check if Docker daemon is active
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not active."
    notify "Pesos" "Error: Docker no está activo. Inicia Docker por favor."
    exit 1
fi

# Trap setup for cleaning up on exit or termination signals
CLEANED_UP=false
cleanup() {
    if [ "$CLEANED_UP" = "true" ]; then
        return
    fi
    CLEANED_UP=true
    
    echo "Stopping all backend services..."
    notify "Pesos" "Cerrando aplicación. Apagando servicios..."
    
    systemctl --user stop "$SERVICE_NAME"
    cd "$APP_DIR" || exit 1
    npx supabase stop >/dev/null 2>&1
    
    notify "Pesos" "Servicios y base de datos apagados correctamente."
    echo "Clean exit."
}

# Trap INT (Ctrl+C), TERM (kill/systemd stop), HUP (terminal closed), and EXIT
trap cleanup INT TERM HUP EXIT

# 2. Check if Supabase local container stack is active
echo "Checking if database is active..."
SUPABASE_STATUS=$(curl -s -o /dev/null -I -w "%{http_code}" --connect-timeout 1 "http://localhost:54321" 2>/dev/null)

if [ "$SUPABASE_STATUS" = "000" ]; then
    echo "Database is down. Starting Supabase dev environment..."
    notify "Pesos" "Iniciando base de datos..."
    cd "$APP_DIR" || exit 1
    
    # Start Supabase in background
    npx supabase start >/dev/null 2>&1 &
else
    echo "Database is already active."
fi

# 3. Check if Next.js app service is active
echo "Checking if Pesos web service is active..."

if systemctl --user is-active --quiet "$SERVICE_NAME"; then
    echo "Pesos systemd service is already running."
else
    echo "Starting Pesos web service..."
    systemctl --user start "$SERVICE_NAME"
    notify "Pesos" "Iniciando servidor web..."
fi

# 5. Resolve browser path dynamically from system settings
browser=$(xdg-settings get default-web-browser)
case $browser in
    google-chrome* | brave* | microsoft-edge* | opera* | vivaldi* | helium*) ;;
    *) browser="chromium.desktop" ;;
esac

BINARY=$(sed -n 's/^Exec=\([^ ]*\).*/\1/p' {~/.local,~/.nix-profile,/usr}/share/applications/$browser 2>/dev/null | head -1)

if [ -z "$BINARY" ]; then
    BINARY="google-chrome-stable"
fi

# Ensure Chrome background mode is disabled for this profile to prevent detached background processes
mkdir -p "$PROFILE_DIR/Default"
if [ ! -f "$PROFILE_DIR/Default/Preferences" ]; then
    echo '{"background_mode":{"enabled":false}}' > "$PROFILE_DIR/Default/Preferences"
else
    node -e "
const fs = require('fs');
const file = '${PROFILE_DIR}/Default/Preferences';
try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data.background_mode) data.background_mode = {};
  data.background_mode.enabled = false;
  fs.writeFileSync(file, JSON.stringify(data));
} catch (e) {
  console.error('Failed to disable background mode:', e);
}
"
fi

# 6. Launch browser in the background and monitor its lifecycle
echo "Launching webapp window..."
"$BINARY" --user-data-dir="$PROFILE_DIR" --app="file://$APP_DIR/public/loading.html" &

# Allow Chrome a moment to spawn its initial processes
sleep 2

# Monitor loop: block as long as Chrome is running with the pesos-profile
echo "Monitoring browser session..."
while pgrep -f "user-data-dir=.*pesos-profile" >/dev/null 2>&1; do
    sleep 1
done

echo "Browser window closed. Script exiting..."
