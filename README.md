# PESOS — Personal OS

> Tu sistema operativo personal para hábitos, finanzas y productividad diaria. Corre 100% local, sin la nube, con un bot de Telegram con IA incluido.

---

## 🚀 Instalación Rápida

### 🐧 Linux

Instalá la app y creá el acceso directo con su ícono ejecutando este único comando en tu terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/getodevel-source/PESOS/main/install.sh | bash
```

> **Nota para Arch / CachyOS / Manjaro / Ubuntu / Debian:** Si la app no abre, asegurate de tener FUSE instalado (requerido por el formato AppImage):
> - **Arch / CachyOS:** `sudo pacman -S fuse2`
> - **Ubuntu / Debian:** `sudo apt install libfuse2`

---

### 🪟 Windows

1. Descargá el instalador `.exe` desde [GitHub Releases](https://github.com/getodevel-source/PESOS/releases/latest).
2. Ejecutalo para instalar la app.

---

### 🍎 macOS

1. Descargá el archivo `.zip` desde [GitHub Releases](https://github.com/getodevel-source/PESOS/releases/latest).
2. Descomprimilo y mové `PESOS.app` a tu carpeta de `/Applications`.
3. La primera vez: hacé **clic derecho → Abrir** para omitir el bloqueo de seguridad de Apple.

---

## ⚙️ Configuración Inicial

Cuando abrís la app por primera vez, verás un **asistente en pantalla** para ingresar tus claves:

1. **Google Gemini API Key** ([conseguila gratis acá](https://aistudio.google.com/app/apikey))
2. **Telegram Bot Token** (opcional, para usar el bot "Pesito" desde el celular)

*Todos los datos se guardan de forma local en tu máquina.*

## 🧹 Desinstalación

Si deseás remover PESOS de tu sistema, seguí estos pasos según tu plataforma:

### 🐧 Linux

Para eliminar por completo el binario, el acceso directo y los iconos creados por el instalador, podés ejecutar este comando:

```bash
rm -f ~/.local/bin/pesos
rm -f ~/.local/share/applications/pesos.desktop
rm -rf ~/.local/share/icons/hicolor/256x256/apps/pesos.png
```

### 🪟 Windows

1. Dirigite a **Configuración** > **Aplicaciones** > **Aplicaciones instaladas**.
2. Buscá **PESOS** en la lista y hacé clic en **Desinstalar**.

### 🍎 macOS

1. Mové la aplicación `PESOS.app` desde tu carpeta `/Applications` directamente al **Basurero**.

> **Nota sobre tus Datos:** Por seguridad y para evitar pérdida accidental de información, la base de datos local SQLite (`pesos.db`) ubicada en tu directorio personal `~/.config/pesos/` **no se borra** automáticamente al desinstalar la app. Si deseás eliminar tus datos de forma permanente, borrá esa carpeta manualmente.

---

## 🛠️ Scripts del Proyecto

El repo incluye tres scripts bash con propósitos distintos. Usá el correcto según lo que necesites:

| Script | Cuándo usarlo | Qué hace |
| --- | --- | --- |
| `install.sh` (raíz) | **Primera instalación** | Detecta tu distro, baja la última release de GitHub, instala el .DEB (Debian/Ubuntu) o el AppImage (Arch/CachyOS) y crea el acceso directo. Idempotente: si ya está instalado, reinstala encima. |
| `scripts/reinstall-pesos-clean.sh` | **Reinstalación limpia** | Borra el binario viejo (con backup), opcionalmente limpia `~/.config/pesos/` y `~/.cache/PESOS/`, descarga la última versión, instala. Interactivo — pregunta antes de borrar. |
| `scripts/update-appimage.sh` | **Actualizar un AppImage ya instalado** | Detecta la versión actual (parsea el AppImage corriendo), consulta GitHub por la última release, valida el download (size, ELF magic, digest), respalda el binario, lo reemplaza. Idempotente y auto-validado. Útil cuando el in-app updater falla o se cuelga. |

**Recomendación** para la mayoría de los updates: abrir la app y click "Buscar actualizaciones" en la sidebar. El in-app updater funciona transparentemente cuando puede. Solo recurrí a los scripts cuando el in-app updater falle (típicamente en Arch/CachyOS por las razones documentadas en el commit `4cbda20c`).

---

## 🛠️ Desarrollo Local / Servidores

Si querés correr el código fuente o montarlo 24/7 en un VPS, consultá la [Guía Completa de Desarrollo](./docs/DEVELOPMENT.md) o usá Docker:

```bash
docker compose up -d --build
```
