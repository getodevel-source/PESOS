#!/usr/bin/env bash
# ============================================================
# PESOS — Auto Installer
# Detecta tu distribución de Linux e instala el paquete correcto
# desde los Releases de GitHub.
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/getodevel-source/PESOS/main/install.sh | bash
#   o bien, si ya lo clonaste:
#   bash install.sh
# ============================================================

REPO="getodevel-source/PESOS"
APP_NAME="PESOS"
INSTALL_VERSION="latest"

# ---- Colores ------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
err()  { echo -e "${RED}✗ Error:${RESET} $*" >&2; exit 1; }

# ---- Banner -------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      PESOS — Auto Installer      ║${RESET}"
echo -e "${BOLD}║   Personal OS · Habits & Finance ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════╝${RESET}"
echo ""

# ---- Detectar SO y gestor de paquetes ----------------------
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="${ID}"
        DISTRO_ID_LIKE="${ID_LIKE}"
    else
        err "No se puede detectar la distribución. ¿Estás en Linux?"
    fi
}

detect_distro

PKG_TYPE=""
INSTALL_CMD=""

# Arch y derivados (Manjaro, CachyOS, EndeavourOS, Garuda...)
# Usamos AppImage + .desktop entry: misma experiencia que un paquete nativo,
# sin los problemas de dependencias del formato pacman de electron-builder.
if echo "$DISTRO_ID $DISTRO_ID_LIKE" | grep -qiE "arch|cachyos|manjaro|endeavour|garuda|artix"; then
    PKG_TYPE="AppImage"
    INSTALL_CMD="portable"
    info "Detectado: Arch Linux / ${PRETTY_NAME:-${DISTRO_ID}}"

# Debian y derivados (Ubuntu, Mint, Pop!_OS, Zorin, elementary...)
elif echo "$DISTRO_ID $DISTRO_ID_LIKE" | grep -qiE "debian|ubuntu|mint|pop|zorin|elementary|kali|mx|linuxmint"; then
    PKG_TYPE="deb"
    INSTALL_CMD="sudo dpkg -i"
    info "Detectado: Debian/Ubuntu / ${PRETTY_NAME:-${DISTRO_ID}}"

# Fedora y derivados
elif echo "$DISTRO_ID $DISTRO_ID_LIKE" | grep -qiE "fedora|rhel|centos|alma|rocky"; then
    PKG_TYPE="AppImage"
    INSTALL_CMD="portable"
    info "Detectado: Fedora/RHEL / ${PRETTY_NAME:-${DISTRO_ID}}"

# Cualquier otra distro → AppImage portable
else
    PKG_TYPE="AppImage"
    INSTALL_CMD="portable"
    warn "Distro no reconocida (${DISTRO_ID}). Usando AppImage portable."
fi

# ---- Obtener la URL del último release de GitHub -----------
info "Obteniendo información del último release desde GitHub..."

if ! command -v curl &>/dev/null; then
    err "curl no está instalado. Instalalo con tu gestor de paquetes y volvé a correr este script."
fi

# Fetch release JSON — use -s (silent) without -f so we get the body even on 4xx
HTTP_CODE=$(curl -s -o /tmp/pesos_release.json -w "%{http_code}" \
    "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null)

if [ "$HTTP_CODE" = "000" ]; then
    err "Sin conexión a internet. Verificá tu red y volvé a intentar."
elif [ "$HTTP_CODE" = "404" ] || echo "$(cat /tmp/pesos_release.json)" | grep -q '"Not Found"'; then
    err "Todavía no hay releases publicados en este repositorio.\n  Descargá los instaladores directamente desde:\n  ${CYAN}https://github.com/${REPO}/releases${RESET}\n  o compilalo vos mismo siguiendo el README."
elif [ "$HTTP_CODE" != "200" ]; then
    err "Error inesperado de la API de GitHub (HTTP $HTTP_CODE). Intentá de nuevo en unos minutos."
fi

RELEASE_JSON=$(cat /tmp/pesos_release.json)
rm -f /tmp/pesos_release.json

# Extraer versión
VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    err "No se pudo parsear la respuesta de GitHub. Intentá de nuevo."
fi

ok "Versión más reciente: ${BOLD}${VERSION}${RESET}"

# Construir nombre del archivo según tipo de paquete
case "$PKG_TYPE" in
    pacman)
        FILE_PATTERN="pesos.*\.pacman"
        ;;
    deb)
        FILE_PATTERN="pesos.*amd64\.deb"
        ;;
    rpm)
        FILE_PATTERN="pesos.*\.rpm"
        ;;
    AppImage)
        FILE_PATTERN="PESOS.*\.AppImage"
        ;;
esac

# Buscar la URL de descarga en los assets
DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "$FILE_PATTERN" | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

if [ -z "$DOWNLOAD_URL" ]; then
    # Fallback a AppImage si no se encontró el paquete nativo
    warn "No se encontró paquete ${PKG_TYPE} para esta versión. Buscando AppImage..."
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "\.AppImage" | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')
    PKG_TYPE="AppImage"
    INSTALL_CMD="portable"
fi

if [ -z "$DOWNLOAD_URL" ]; then
    err "No se encontró ningún archivo de instalación en el release ${VERSION}.\nVisitá manualmente: https://github.com/${REPO}/releases"
fi

FILENAME=$(basename "$DOWNLOAD_URL")
TMPDIR_PESOS=$(mktemp -d)

# ---- Descargar ---------------------------------------------
info "Descargando ${BOLD}${FILENAME}${RESET}..."
curl -L --progress-bar "$DOWNLOAD_URL" -o "${TMPDIR_PESOS}/${FILENAME}"
ok "Descarga completada."

# ---- Instalar ----------------------------------------------
echo ""
info "Instalando ${APP_NAME}..."

case "$PKG_TYPE" in
    pacman)
        $INSTALL_CMD "${TMPDIR_PESOS}/${FILENAME}"
        ok "${APP_NAME} instalado con pacman."
        ;;
    deb)
        $INSTALL_CMD "${TMPDIR_PESOS}/${FILENAME}" || {
            warn "Falló dpkg. Intentando resolver dependencias con apt-get..."
            sudo apt-get install -f -y
        }
        ok "${APP_NAME} instalado con dpkg."
        ;;
    rpm)
        $INSTALL_CMD "${TMPDIR_PESOS}/${FILENAME}"
        ok "${APP_NAME} instalado con rpm/dnf."
        ;;
    AppImage|portable)
        # AppImage: instalar en ~/.local/bin con nombre limpio
        INSTALL_PATH="$HOME/.local/bin/pesos"
        mkdir -p "$HOME/.local/bin"
        cp "${TMPDIR_PESOS}/${FILENAME}" "$INSTALL_PATH"
        chmod +x "$INSTALL_PATH"
        ok "AppImage instalado en ${BOLD}${INSTALL_PATH}${RESET}"

        # Extraer ícono embebido del AppImage (si está disponible)
        ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
        mkdir -p "$ICON_DIR"
        # Intentar extraer el ícono directamente del AppImage
        cd /tmp
        rm -rf squashfs-root
        "$INSTALL_PATH" --appimage-extract "usr/share/icons/hicolor/*/apps/pesos.png" >/dev/null 2>&1 || true
        EXTRACTED_ICON=$(find /tmp/squashfs-root -name "pesos.png" 2>/dev/null | head -1)
        if [ -n "$EXTRACTED_ICON" ]; then
            cp "$EXTRACTED_ICON" "$ICON_DIR/pesos.png"
            rm -rf /tmp/squashfs-root
            ok "Ícono extraído e instalado."
        else
            warn "No se pudo extraer el ícono automáticamente. Es posible que falte la dependencia FUSE (paquete 'fuse2' en Arch o 'libfuse2' en Ubuntu)."
        fi
        cd - >/dev/null

        # Crear .desktop entry completo
        DESKTOP_FILE="$HOME/.local/share/applications/pesos.desktop"
        mkdir -p "$HOME/.local/share/applications"
        cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Name=PESOS
GenericName=Personal OS
Comment=Hábitos, finanzas y productividad personal con IA
Exec=${INSTALL_PATH} %U
Icon=${ICON_DIR}/pesos.png
Type=Application
Categories=Office;Finance;Utility;
StartupWMClass=pesos
StartupNotify=true
Keywords=hábitos;finanzas;productividad;telegram;
DESKTOP
        ok "Acceso directo creado en el menú de aplicaciones."

        # Verificar si ~/.local/bin está en PATH
        if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
            warn "~/.local/bin no está en tu PATH."
            warn "Agregá esta línea a tu ~/.bashrc o ~/.zshrc y reiniciá la terminal:"
            echo -e "  ${CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}"
        fi

        # Actualizar índice de aplicaciones del escritorio
        if command -v update-desktop-database &>/dev/null; then
            update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
        fi
        if command -v xdg-desktop-menu &>/dev/null; then
            xdg-desktop-menu forceupdate 2>/dev/null || true
        fi
        ;;
esac

# ---- Limpiar temporales ------------------------------------
rm -rf "$TMPDIR_PESOS"

# ---- Instrucciones post-instalación ------------------------
echo ""
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ¡${APP_NAME} instalado correctamente!  🎉${RESET}"
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Próximos pasos:${RESET}"
echo -e "  1. Buscá ${CYAN}PESOS${RESET} en el menú de aplicaciones o lanzalo desde terminal:"

if [ "$PKG_TYPE" = "AppImage" ] || [ "$PKG_TYPE" = "portable" ]; then
    echo -e "     ${CYAN}pesos${RESET}"
else
    echo -e "     ${CYAN}pesos${RESET}  (o buscalo en tu lanzador de apps)"
fi


echo ""
echo -e "  2. La primera vez que lo abrás, ${BOLD}configurá tus variables de entorno${RESET}"
echo -e "     en Settings dentro de la app (Telegram Bot Token, API Key de IA)."
echo ""
echo -e "  📚 Docs: ${CYAN}https://github.com/${REPO}#readme${RESET}"
echo ""
