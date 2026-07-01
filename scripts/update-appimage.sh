#!/usr/bin/env bash
# update-appimage.sh — Update the Pesos AppImage to the latest GitHub release.
#
# What it does:
#   1. Detects the currently-installed AppImage (`command -v pesos` + realpath).
#   2. Reads the running AppImage's package.json to find the current version.
#   3. Asks GitHub for the latest release of getodevel-source/PESOS.
#   4. If you're already up to date, exits cleanly (idempotent no-op).
#   5. Downloads the new AppImage to a temp file with a progress bar.
#   6. Validates the download: size (±1%), ELF magic bytes, SHA512 (if GitHub
#      provided a digest).
#   7. Backs up the current AppImage as <path>.v<oldversion>.AppImage.bak
#      (the backup is NOT deleted — you can revert manually).
#   8. Replaces the current AppImage with `mv` and `chmod +x`.
#   9. Optionally relaunches the new AppImage in the background (Y/n, default Y).
#
# What it does NOT do:
#   - It does NOT kill the currently-running Pesos instance. You close the old
#     one manually after the new one starts; the new instance is detached via
#     `nohup ... &` and `disown`.
#   - It does NOT touch ~/config/pesos, ~/.cache/PESOS, or any user data.
#   - It does NOT require sudo, npm, or any Node tooling.
#   - It does NOT commit, tag, or release anything — only you do that.
#
# Dependencies: bash, curl, jq, python3 (with `packaging` — falls back to `sort
# -V` if missing), standard Unix tools. `gh` is used opportunistically if
# already authenticated.
#
# Flags:
#   -y, --yes     Skip all confirmation prompts (for cron / scripts).
#   -h, --help    Show this help and exit.
#
# Re-running this script with no new release between calls is a safe no-op
# that just prints "you are up to date".

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
readonly GITHUB_REPO="getodevel-source/PESOS"
readonly API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"

# ─── CLI flags ───────────────────────────────────────────────────────────────
ASSUME_YES=0
print_usage() {
  sed -n '2,33p' "$0"
  exit 0
}
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) print_usage ;;
    *) printf 'Unknown flag: %s\n' "$1" >&2; exit 2 ;;
  esac
done

# ─── Colors (only on TTY) ────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi
log()  { printf '%b\n' "$*" >&2; }
info() { log "${CYAN}▸${RESET} $*"; }
ok()   { log "${GREEN}✓${RESET} $*"; }
warn() { log "${YELLOW}!${RESET} $*"; }
err()  { log "${RED}✗${RESET} $*"; }
die()  { err "$*"; exit 1; }

# ─── Cleanup trap (always runs, even on error/interrupt) ─────────────────────
TMPFILE=""
TMPDIR_EXTRACT=""
cleanup() {
  if [ -n "${TMPFILE}" ] && [ -f "${TMPFILE}" ]; then
    rm -f "${TMPFILE}" 2>/dev/null || true
  fi
  if [ -n "${TMPDIR_EXTRACT}" ] && [ -d "${TMPDIR_EXTRACT}" ]; then
    rm -rf "${TMPDIR_EXTRACT}" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ─── Helper: prompt with Y/n default ─────────────────────────────────────────
confirm() {
  local prompt="$1"
  if [ "${ASSUME_YES}" -eq 1 ]; then
    return 0
  fi
  printf "%s%s [Y/n]%s " "$YELLOW" "$prompt" "$RESET" >&2
  local ans=""
  read -r ans || ans=""
  case "${ans:-Y}" in
    [Yy]|[Yy][Ee][Ss]|'') return 0 ;;
    *) return 1 ;;
  esac
}

# ─── Helper: version compare (a < b ? 0 : 1) ────────────────────────────────
is_older() {
  local a="$1" b="$2"

  # Preferred: packaging.version (PEP 440). Cleanly handles pre-releases,
  # dev builds, etc.
  if python3 - "$a" "$b" <<'PY' 2>/dev/null
from packaging.version import Version, InvalidVersion
import sys
try:
    a = Version(sys.argv[1]); b = Version(sys.argv[2])
except (InvalidVersion, ValueError):
    sys.exit(2)
sys.exit(0 if a < b else 1)
PY
  then
    return 0
  elif [ $? -eq 2 ]; then
    die "Versión inválida: '$a' o '$b'."
  fi
  # Fallback: sort -V (no pre-release awareness, but good enough for x.y.z)
  local lower
  lower="$(printf '%s\n%s\n' "$a" "$b" | sort -V | head -n1)"
  if [ "$lower" = "$a" ] && [ "$a" != "$b" ]; then
    return 0
  fi
  return 1
}

# ─── Pre-flight: detect current install ─────────────────────────────────────
info "Detectando instalación actual..."

CURRENT_PATH=""
if CURRENT_PATH="$(command -v pesos 2>/dev/null || true)" && [ -n "${CURRENT_PATH}" ]; then
  :
else
  # Convention: ~/Applications/PESOS-*.AppImage or ~/.local/bin/pesos
  for candidate in \
    "${HOME}/Applications/PESOS.AppImage" \
    "${HOME}/.local/bin/pesos"; do
    if [ -f "${candidate}" ]; then
      CURRENT_PATH="${candidate}"
      break
    fi
  done
fi

if [ -z "${CURRENT_PATH}" ] || [ ! -f "${CURRENT_PATH}" ]; then
  die "No se encontró una instalación de pesos. Probá \`command -v pesos\` o instalá con scripts/reinstall-pesos-clean.sh."
fi

# Resolve symlinks if realpath is available
if command -v realpath >/dev/null 2>&1; then
  CURRENT_PATH="$(realpath "${CURRENT_PATH}" 2>/dev/null || echo "${CURRENT_PATH}")"
fi

# Verify it's actually an ELF / AppImage.
# Use `xxd` for the magic-byte check because `od` is hijacked by the Open
# Design daemon wrapper on some developer machines. ELF = 7f 45 4c 46.
MAGIC_HEX="$(head -c 4 "${CURRENT_PATH}" 2>/dev/null | xxd -p 2>/dev/null | head -c 8 || true)"
if [ "${MAGIC_HEX}" != "7f454c46" ]; then
  die "El archivo en ${CURRENT_PATH} no parece un AppImage (magic=${MAGIC_HEX:-empty}, esperado 7f454c46)."
fi
ok "Instalación: ${BOLD}${CURRENT_PATH}${RESET} (ELF/AppImage)"

# ─── Step 1: read the current version from inside the AppImage ───────────────
info "Extrayendo package.json del AppImage para leer la versión actual..."

TMPDIR_EXTRACT="$(mktemp -d -t pesos-update-XXXXXX)"

# `--appimage-extract <path>` extracts a single file to ./squashfs-root/.
# If the build only supports bare `--appimage-extract`, the whole tree lands
# at the same place — both paths converge on the same PKG_JSON below.
if ! (cd "${TMPDIR_EXTRACT}" && "${CURRENT_PATH}" --appimage-extract 'resources/app/package.json' >/dev/null 2>&1); then
  if ! (cd "${TMPDIR_EXTRACT}" && "${CURRENT_PATH}" --appimage-extract >/dev/null 2>&1); then
    die "No se pudo extraer resources/app/package.json del AppImage. Cerrá la app si está corriendo y volvé a intentar."
  fi
fi

PKG_JSON="${TMPDIR_EXTRACT}/squashfs-root/resources/app/package.json"
if [ ! -f "${PKG_JSON}" ]; then
  die "Extracción incompleta: no se encontró ${PKG_JSON}."
fi

CURRENT_VERSION="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "${PKG_JSON}" \
  | head -n1 \
  | sed -E 's/.*"([^"]+)"$/\1/')"

if [ -z "${CURRENT_VERSION}" ]; then
  die "No se pudo parsear la versión de ${PKG_JSON}."
fi
ok "Versión actual: ${BOLD}${CURRENT_VERSION}${RESET}"

# Free the extraction dir — we no longer need it
rm -rf "${TMPDIR_EXTRACT}"
TMPDIR_EXTRACT=""

# ─── Step 2: query GitHub for the latest release ─────────────────────────────
info "Consultando GitHub por la última release de ${GITHUB_REPO}..."

RELEASE_JSON=""
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  if RELEASE_JSON="$(gh api "repos/${GITHUB_REPO}/releases/latest" 2>/dev/null)"; then
    : # got it via gh
  else
    warn "gh falló, cayendo a curl directo."
    RELEASE_JSON=""
  fi
fi

if [ -z "${RELEASE_JSON}" ]; then
  if ! RELEASE_JSON="$(curl --fail --silent --show-error --location \
        -H 'Accept: application/vnd.github+json' \
        -H 'X-GitHub-Api-Version: 2022-11-28' \
        "${API_URL}" 2>/dev/null)"; then
    die "No se pudo obtener la release latest de GitHub. Revisá tu conexión a internet."
  fi
fi

LATEST_TAG="$(printf '%s' "${RELEASE_JSON}" | jq -r '.tag_name // empty')"
LATEST_VERSION="${LATEST_TAG#v}"

if [ -z "${LATEST_VERSION}" ]; then
  die "GitHub no devolvió tag_name. ¿La repo ${GITHUB_REPO} tiene alguna release publicada?"
fi
ok "Última release en GitHub: ${BOLD}v${LATEST_VERSION}${RESET}"

# ─── Step 3: locate the AppImage asset in the release ───────────────────────
EXPECTED_NAME="PESOS-${LATEST_VERSION}.AppImage"
ASSET_JSON="$(printf '%s' "${RELEASE_JSON}" \
  | jq -r --arg name "${EXPECTED_NAME}" \
       '.assets[] | select(.name == $name) | {url: .browser_download_url, size: .size, digest: .digest}')"

ASSET_URL="$(printf '%s' "${ASSET_JSON}" | jq -r '.url // empty')"
EXPECTED_SIZE="$(printf '%s' "${ASSET_JSON}" | jq -r '.size // 0')"
EXPECTED_DIGEST="$(printf '%s' "${ASSET_JSON}" | jq -r '.digest // empty' | head -n1)"

if [ -z "${ASSET_URL}" ]; then
  die "No se encontró el asset '${EXPECTED_NAME}' en la release v${LATEST_VERSION}. Revisá que electron-builder haya subido el AppImage."
fi
ok "Asset: ${ASSET_URL}"
[ "${EXPECTED_SIZE}" -gt 0 ] && info "Tamaño esperado: ${EXPECTED_SIZE} bytes"
[ -n "${EXPECTED_DIGEST}" ] && info "Digest declarado: ${EXPECTED_DIGEST}"

# ─── Step 4: compare versions ────────────────────────────────────────────────
if ! is_older "${CURRENT_VERSION}" "${LATEST_VERSION}"; then
  ok "Ya estás en la última versión (${CURRENT_VERSION}). Nada que hacer."
  exit 0
fi

info "Actualización disponible: ${BOLD}${CURRENT_VERSION}${RESET} → ${BOLD}${LATEST_VERSION}${RESET}"
confirm "¿Descargar y aplicar la actualización?" || { warn "Cancelado por el usuario."; exit 0; }

# ─── Step 5: download the new AppImage ───────────────────────────────────────
TMPFILE="$(mktemp -t pesos-update-XXXXXX)"
info "Descargando ${EXPECTED_NAME} → ${TMPFILE}"
if ! curl --fail --location --progress-bar --output "${TMPFILE}" "${ASSET_URL}"; then
  die "Falló la descarga desde ${ASSET_URL}."
fi
ok "Descarga completa"

# ─── Step 6: validate the download ───────────────────────────────────────────
info "Validando la descarga..."

# Size check (±1%)
ACTUAL_SIZE="$(stat -c %s "${TMPFILE}" 2>/dev/null || wc -c < "${TMPFILE}")"
if [ "${EXPECTED_SIZE}" -gt 0 ]; then
  TOL_OK="$(python3 -c "
exp = ${EXPECTED_SIZE}
act = ${ACTUAL_SIZE}
print('1' if abs(exp - act) <= exp * 0.01 else '0')
")"
  if [ "${TOL_OK}" != "1" ]; then
    die "Tamaño incorrecto: esperado ${EXPECTED_SIZE} bytes, obtenido ${ACTUAL_SIZE} bytes (diff > 1%). Posible descarga corrupta."
  fi
  ok "Tamaño OK (${ACTUAL_SIZE} bytes, esperado ${EXPECTED_SIZE})"
else
  warn "Saltando chequeo de tamaño (GitHub no devolvió size)."
fi

# Magic bytes (ELF)
MAGIC2_HEX="$(head -c 4 "${TMPFILE}" | xxd -p 2>/dev/null | head -c 8 || true)"
if [ "${MAGIC2_HEX}" != "7f454c46" ]; then
  die "Magic bytes incorrectos: '${MAGIC2_HEX}' (esperado '7f454c46'). No es un binario ELF/AppImage."
fi
ok "Magic bytes OK (ELF)"

# Digest check (if GitHub provided one). GitHub typically publishes sha256,
# occasionally sha512. Use whichever prefix the release declares.
if [ -n "${EXPECTED_DIGEST}" ]; then
  case "${EXPECTED_DIGEST}" in
    sha512:*) ALGO="sha512"; SUMCMD="sha512sum" ;;
    sha256:*) ALGO="sha256"; SUMCMD="sha256sum" ;;
    sha1:*)   ALGO="sha1";   SUMCMD="sha1sum" ;;
    *)        ALGO="";       SUMCMD="" ;;
  esac
  if [ -z "${SUMCMD}" ] || ! command -v "${SUMCMD}" >/dev/null 2>&1; then
    warn "Digest ${EXPECTED_DIGEST} requiere ${SUMCMD:-herramienta desconocida} — saltando."
  else
    EXPECTED_HASH="${EXPECTED_DIGEST#*:}"
    ACTUAL_HASH="$("${SUMCMD}" "${TMPFILE}" | awk '{print $1}')"
    if [ "${ACTUAL_HASH}" != "${EXPECTED_HASH}" ]; then
      die "${ALGO} no coincide. Esperado ${EXPECTED_HASH}, obtenido ${ACTUAL_HASH}."
    fi
    ok "${ALGO} OK"
  fi
else
  warn "GitHub no proveyó digest — saltando verificación de hash."
fi

# ─── Step 7: back up the current AppImage ────────────────────────────────────
BACKUP_PATH="${CURRENT_PATH}.v${CURRENT_VERSION}.AppImage.bak"
if [ -e "${BACKUP_PATH}" ]; then
  # Don't clobber a previous backup; suffix with a timestamp.
  STAMP="$(date +%Y%m%d-%H%M%S)"
  BACKUP_PATH="${BACKUP_PATH%.bak}.${STAMP}.bak"
  warn "Ya existía un backup. Renombrando a ${BACKUP_PATH}"
fi

info "Respaldando ${CURRENT_PATH} → ${BACKUP_PATH}"
if ! mv "${CURRENT_PATH}" "${BACKUP_PATH}"; then
  die "No se pudo respaldar el AppImage actual. Abortando (tu AppImage sigue intacto)."
fi
ok "Backup guardado en ${BACKUP_PATH}"

# ─── Step 8: install the new AppImage ────────────────────────────────────────
info "Instalando ${EXPECTED_NAME} → ${CURRENT_PATH}"
if ! mv "${TMPFILE}" "${CURRENT_PATH}"; then
  err "No se pudo mover el nuevo AppImage a ${CURRENT_PATH}."
  err "Tu versión anterior sigue en: ${BACKUP_PATH}"
  err "Para recuperarla manualmente: mv '${BACKUP_PATH}' '${CURRENT_PATH}' && chmod +x '${CURRENT_PATH}'"
  exit 1
fi
TMPFILE=""  # already moved; don't let the EXIT trap delete it

chmod +x "${CURRENT_PATH}"
ok "Instalado en ${CURRENT_PATH} (chmod +x)"

# ─── Step 9: optional relaunch ───────────────────────────────────────────────
if confirm "¿Relanzar la app ahora?"; then
  info "Relanzando ${CURRENT_PATH} en background..."
  nohup "${CURRENT_PATH}" >/dev/null 2>&1 &
  RELAUNCH_PID=$!
  disown "${RELAUNCH_PID}" 2>/dev/null || true
  ok "Relanzado (PID ${RELAUNCH_PID})."
  info "Cerrá la instancia anterior cuando quieras — la nueva ya está corriendo."
  info "Para forzar el cierre de la anterior: pkill -f -i 'pesos'"
else
  warn "No se relanzó. Iniciá manualmente: ${CURRENT_PATH}"
fi

echo
ok "Listo. Pesos v${LATEST_VERSION} instalado."
echo
info "Si algo salió mal, tu versión anterior está en: ${BACKUP_PATH}"
info "Para revertir:  mv '${BACKUP_PATH}' '${CURRENT_PATH}' && chmod +x '${CURRENT_PATH}'"
