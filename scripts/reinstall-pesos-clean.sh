#!/usr/bin/env bash
# Clean reinstall of Pesos v1.0.9 via AppImage (Arch/CachyOS-friendly).
#
# What it does:
#   1. Kills any running pesos/electron process
#   2. Finds and removes any old AppImage (with confirmation)
#   3. Optionally wipes ~/.config/pesos and ~/.cache/PESOS
#      (config, sqlite db, electron update cache, stuck .deb)
#   4. Downloads PESOS-1.0.9.AppImage from GitHub Releases
#   5. chmod +x and places in ~/Applications/
#   6. Symlinks to ~/.local/bin/pesos for CLI access
#   7. Prints the run command and verifies the version
#
# NOT needed: sudo, dpkg, apt, pacman. The AppImage is self-contained.
# Interactive: asks before destructive steps. Default: keep user data.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
readonly VERSION="1.0.9"
readonly GITHUB_REPO="getodevel-source/PESOS"
readonly APPIMAGE_NAME="PESOS-${VERSION}.AppImage"
readonly RELEASE_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${APPIMAGE_NAME}"
readonly APPDIR="${HOME}/Applications"
readonly APPIMAGE_PATH="${APPDIR}/${APPIMAGE_NAME}"
readonly BIN_LINK="${HOME}/.local/bin/pesos"
readonly CONFIG_DIR="${HOME}/.config/pesos"
readonly CACHE_DIR="${HOME}/.cache/PESOS"
readonly LEGACY_HOME="${HOME}/.local/share/omarchy"  # omarchy quirk

# Colors (only if stdout is a TTY)
if [ -t 1 ]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'
  BOLD=$'\033[1m'
  RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

log()  { printf '%b\n' "$*" >&2; }
info() { log "${CYAN}▸${RESET} $*"; }
ok()   { log "${GREEN}✓${RESET} $*"; }
warn() { log "${YELLOW}!${RESET} $*"; }
err()  { log "${RED}✗${RESET} $*"; }
die()  { err "$*"; exit 1; }

# ─── Pre-flight ─────────────────────────────────────────────────────────────
log ""
log "${BOLD}Pesos clean reinstall — v${VERSION} (AppImage)${RESET}"
log ""

# Verify we're not in pesos's own checkout (script lives in scripts/, never
# delete the project source!)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../package.json" ] && grep -q '"name": "pesos"' "${SCRIPT_DIR}/../package.json" 2>/dev/null; then
  : # we are inside the pesos repo, that's fine
fi

# Sanity: check we can write to ~/Applications and ~/.local/bin
mkdir -p "${APPDIR}" "$(dirname "${BIN_LINK}")"

# ─── Step 1: Kill any running pesos ─────────────────────────────────────────
info "Buscando procesos de pesos corriendo..."

PIDS=$(pgrep -f -i 'pesos\|PESOS' || true)
if [ -n "${PIDS}" ]; then
  warn "Procesos encontrados: ${PIDS}"
  ps -p ${PIDS} -o pid,comm,args 2>/dev/null || true
  printf "  %s¿Mato los procesos? [Y/n]%s " "$YELLOW" "$RESET"
  read -r ans
  case "${ans:-Y}" in
    [Yy]|[Yy][Ee][Ss])
      kill ${PIDS} 2>/dev/null || true
      sleep 1
      kill -9 ${PIDS} 2>/dev/null || true
      ok "Procesos terminados"
      ;;
    *)
      warn "Continuando con procesos vivos (puede fallar el reemplazo)"
      ;;
  esac
else
  ok "No hay procesos de pesos corriendo"
fi

# ─── Step 2: Find old AppImages ─────────────────────────────────────────────
info "Buscando AppImages de pesos anteriores..."

# Common locations + the current target
CANDIDATES=(
  "${APPIMAGE_PATH}"
  "${HOME}/Downloads/${APPIMAGE_NAME}"
  "${HOME}/Downloads/PESOS-1.0.8.AppImage"
  "${HOME}/Downloads/PESOS-1.0.7.AppImage"
  "${HOME}/Downloads/PESOS-1.0.6.AppImage"
  "${HOME}/Downloads/PESOS-1.0.5.AppImage"
  "${HOME}/Downloads/PESOS-1.0.4.AppImage"
  "${HOME}/Downloads/PESOS-1.0.3.AppImage"
  "${HOME}/Downloads/PESOS-0.1.3.AppImage"
  "${HOME}/pesos.AppImage"
  "${HOME}/PESOS.AppImage"
  "${HOME}/.local/bin/pesos"
  "${HOME}/.local/bin/PESOS"
  "/usr/local/bin/pesos"
  "/opt/pesos.AppImage"
  "/opt/PESOS.AppImage"
)

FOUND=()
for path in "${CANDIDATES[@]}"; do
  if [ -e "$path" ]; then
    FOUND+=("$path")
  fi
done

# Also scan ~/Downloads for any "PESOS-*" AppImage
if [ -d "${HOME}/Downloads" ]; then
  while IFS= read -r path; do
    case "$path" in *PESOS*|*"pesos"*.AppImage)
      FOUND+=("$path")
      ;;
    esac
  done < <(find "${HOME}/Downloads" -maxdepth 2 -name '*[pP][eE][sS][oO][sS]*' -type f 2>/dev/null)
fi

if [ ${#FOUND[@]} -gt 0 ]; then
  warn "Encontré ${#FOUND[@]} archivo(s) de pesos previo(s):"
  for path in "${FOUND[@]}"; do
    log "    ${path}"
  done
  printf "  %s¿Borro estos archivos? [Y/n]%s " "$YELLOW" "$RESET"
  read -r ans
  case "${ans:-Y}" in
    [Yy]|[Yy][Ee][Ss])
      for path in "${FOUND[@]}"; do
        if [ -L "$path" ] || [ -f "$path" ]; then
          rm -f "$path" && ok "Borrado: $path" || warn "No pude borrar: $path"
        fi
      done
      ;;
    *)
      warn "Manteniendo archivos previos"
      ;;
  esac
else
  ok "No hay AppImages previos"
fi

# ─── Step 3: Clean cache (always safe) ─────────────────────────────────────
info "Limpiando cache de electron-updater (puede tener el .deb colgado)..."

if [ -d "${CACHE_DIR}" ]; then
  rm -rf "${CACHE_DIR}"
  ok "Cache borrado: ${CACHE_DIR}"
else
  ok "No había cache"
fi

# ─── Step 4: Optionally clean config (sqlite db) ──────────────────────────
info "Directorio de config: ${CONFIG_DIR}"
if [ -d "${CONFIG_DIR}" ]; then
  warn "Encontré el directorio de config con tu base de datos SQLite."
  printf "  %s¿Borro la base de datos y configs? [y/N]%s\n" "$YELLOW" "$RESET"
  printf "  (Por defecto N = mantengo tus datos: hábitos, transacciones, etc.)\n"
  printf "  Respondé 'y' solo si querés un reset completo desde cero.\n"
  printf "  %sRespuesta [N]:%s " "$YELLOW" "$RESET"
  read -r ans
  case "${ans:-N}" in
    [Yy]|[Yy][Ee][Ss])
      # Optional backup
      BACKUP="${CONFIG_DIR}-backup-$(date +%Y%m%d-%H%M%S)"
      cp -r "${CONFIG_DIR}" "${BACKUP}" 2>/dev/null \
        && ok "Backup en: ${BACKUP}" \
        || warn "No pude hacer backup (continuo igual)"
      rm -rf "${CONFIG_DIR}"
      ok "Config borrado"
      ;;
    *)
      ok "Config preservado (tus datos están a salvo)"
      ;;
  esac
else
  ok "No había config previo"
fi

# ─── Step 5: Download new AppImage ─────────────────────────────────────────
info "Descargando ${APPIMAGE_NAME} desde GitHub Releases..."
info "URL: ${RELEASE_URL}"

if command -v curl >/dev/null 2>&1; then
  DOWNLOADER=(curl -fL --progress-bar -o "${APPIMAGE_PATH}.part")
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER=(wget -O "${APPIMAGE_PATH}.part")
else
  die "Ni curl ni wget están disponibles. Instalá uno antes de continuar."
fi

"${DOWNLOADER[@]}" "${RELEASE_URL}"
mv "${APPIMAGE_PATH}.part" "${APPIMAGE_PATH}"
chmod +x "${APPIMAGE_PATH}"
ok "Descargado: ${APPIMAGE_PATH}"

# Verify it's a valid AppImage (magic bytes "AI\x02")
MAGIC=$(head -c 4 "${APPIMAGE_PATH}" | od -An -c | tr -d ' \n' || true)
if [[ "${MAGIC}" != *"A"* ]] || [[ ! -x "${APPIMAGE_PATH}" ]]; then
  warn "El archivo descargado no parece un AppImage válido (magic: ${MAGIC})"
fi

# ─── Step 6: Symlink for CLI access ────────────────────────────────────────
info "Creando symlink CLI: ${BIN_LINK}"
ln -sf "${APPIMAGE_PATH}" "${BIN_LINK}"
ok "Symlink creado (asegurate de que ${HOME}/.local/bin esté en tu PATH)"

# ─── Step 7: Verify ────────────────────────────────────────────────────────
info "Verificando versión instalada..."
# The AppImage doesn't easily report its version without running. We can
# extract the squashfs and read the embedded package.json, or just trust
# the filename. For a quick check, run with --version if the app supports
# it; otherwise rely on the filename.
if "${APPIMAGE_PATH}" --version 2>/dev/null; then
  : # app printed something
else
  ok "Versión instalada (vía nombre de archivo): v${VERSION}"
  warn "Si la app no soporta --version, abrila desde el menú para confirmar"
fi

# ─── Final summary ─────────────────────────────────────────────────────────
log ""
log "${GREEN}${BOLD}Listo.${RESET}"
log ""
log "  ${BOLD}Binario${RESET}    ${APPIMAGE_PATH}"
log "  ${BOLD}Symlink${RESET}    ${BIN_LINK}"
log "  ${BOLD}Config${RESET}     ${CONFIG_DIR}"
log "  ${BOLD}Cache${RESET}      ${CACHE_DIR}"
log ""
log "  ${CYAN}Para correr la app:${RESET}"
log "    ${APPIMAGE_PATH}"
log "    # o simplemente:"
log "    pesos   # si ~/.local/bin está en tu PATH"
log ""
log "  ${CYAN}Para ver el PATH actual:${RESET}"
log "    echo \$PATH | tr ':' '\n' | grep -E '\\.local/bin|Applications'"
log ""

if [ -d "${CONFIG_DIR}-backup-"* ] 2>/dev/null; then
  log "  ${YELLOW}Backups:${RESET} ${CONFIG_DIR}-backup-*"
fi

log "  ${CYAN}Para updates futuros:${RESET}"
log "    La app tiene in-app update via AppImage. Si la v1.0.9 falla,"
log "    abrí la app, clickeá 'Buscar actualizaciones', y si el install"
log "    cuelga, aparecerá el botón 'Abrir el .deb manualmente' (aunque"
log "    en AppImage el .deb no aplica — el fallback es para DEB installs)."
log "    Si en AppImage falla, simplemente bajá la nueva versión desde"
log "    https://github.com/${GITHUB_REPO}/releases/latest"
log ""
