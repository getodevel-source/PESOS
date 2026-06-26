# PESOS — Personal OS

> **Tu sistema operativo personal para hábitos, finanzas y productividad diaria.** Corre 100% local, sin dependencias en la nube, con un bot de Telegram con IA incluido.

---

## ¿Qué es PESOS?

PESOS es una aplicación de escritorio (Electron + Next.js) que centraliza todo lo que necesitás para organizar tu vida diaria:

| Módulo | Descripción |
|--------|-------------|
| 📅 **Dashboard** | Vista del día con tareas, recordatorios y bitácora emocional |
| 🔄 **Hábitos** | Seguimiento diario con rachas y sistema de XP |
| 💰 **Finanzas** | Ingresos, gastos y conversión automática ARS/USD (Dólar MEP) |
| ⚔️ **Gamificación RPG** | Subís de nivel, ganás logros y desbloqueás recompensas |
| 🤖 **Bot "Pesito"** | Telegram bot con IA para registrar gastos y tareas por voz o texto |
| 🔒 **100% Local** | Base de datos SQLite embebida. Tus datos nunca salen de tu PC |

---

## Instalación Rápida (Linux)

La forma más simple: un comando detecta tu distro y descarga e instala el paquete correcto.

```bash
curl -fsSL https://raw.githubusercontent.com/getodevel/PESOS/main/install.sh | bash
```

> **¿Qué hace el script?**
> 1. Detecta tu distribución (Arch, Ubuntu, Debian, Fedora, etc.)
> 2. Descarga el instalador correcto desde GitHub Releases
> 3. Lo instala con tu gestor de paquetes nativo
> 4. Crea el acceso directo en tu menú de aplicaciones

---

## Instalación Manual por Sistema Operativo

### 🐧 Linux

Descargá el instalador correcto para tu distro desde [GitHub Releases](https://github.com/getodevel/PESOS/releases/latest):

#### Arch Linux / CachyOS / Manjaro / EndeavourOS

```bash
# Descargá el .pacman desde Releases y ejecutá:
sudo pacman -U pesos-0.1.0.pacman

# Con AUR helper (recomendado):
paru -U pesos-0.1.0.pacman
# o
yay -U pesos-0.1.0.pacman
```

#### Ubuntu / Debian / Linux Mint / Pop!_OS / Zorin OS

```bash
# Descargá el .deb desde Releases y ejecutá:
sudo dpkg -i pesos_0.1.0_amd64.deb

# Si hay dependencias faltantes, resolvelas automáticamente:
sudo apt-get install -f
```

#### Fedora / Red Hat / AlmaLinux / Rocky Linux

> Por ahora no distribuimos `.rpm` nativo. Usá el AppImage portable (ver abajo).

#### Cualquier distro — AppImage Portable

El AppImage no requiere instalación. Funciona en cualquier distribución Linux moderna.

```bash
# Descargá PESOS-0.1.0.AppImage desde Releases
chmod +x PESOS-0.1.0.AppImage
./PESOS-0.1.0.AppImage
```

> **⚠️ Nota para sistemas modernos (Ubuntu 22.04+, Arch reciente):**
> El AppImage requiere `libfuse2`. Si no abre:
>
> ```bash
> # Arch / CachyOS / Manjaro
> sudo pacman -S libfuse2
>
> # Ubuntu / Debian / Mint
> sudo apt install libfuse2
>
> # Fedora
> sudo dnf install fuse
> ```

---

### 🪟 Windows

1. Descargá `PESOS Setup 0.1.0.exe` desde [Releases](https://github.com/getodevel/PESOS/releases/latest)
2. Ejecutá el instalador y seguí los pasos
3. La app queda en el menú de inicio y en la bandeja del sistema (System Tray)

> **Truco:** Al cerrar la ventana con la ✕, la app sigue corriendo en segundo plano (en la bandeja). El bot de Telegram permanece activo. Para cerrarla por completo, clic derecho sobre el ícono → **Salir**.

---

### 🍎 macOS

1. Descargá `PESOS-0.1.0-mac.zip` desde [Releases](https://github.com/getodevel/PESOS/releases/latest)
2. Descomprimí y arrastrá `PESOS.app` a `/Applications`
3. Primera ejecución: **clic derecho → Abrir** (para saltear la verificación de Gatekeeper)

> Para compilar una versión firmada con certificado Apple, seguí las instrucciones en [MACOS_BUILD.md](./MACOS_BUILD.md).

---

## Configuración (Variables de Entorno)

Antes de usar el Bot de Telegram y la IA, necesitás configurar las claves. Creá un archivo `.env.local` en la raíz de la app (donde está `electron.js`):

```bash
# ── Bot de Telegram ──────────────────────────────────────────
# Obtenelo gratis en https://t.me/BotFather
TELEGRAM_BOT_TOKEN="tu-token-de-botfather"

# ── Inteligencia Artificial (usá al menos una) ────────────────
# Google Gemini (recomendado): https://aistudio.google.com/app/apikey
GOOGLE_AI_API_KEY="tu-api-key-de-gemini"

# OpenCode / DeepSeek (alternativa):
OPENCODE_GO_API_KEY="tu-api-key"
```

> El archivo `.env.local` **nunca se sube a git** (está en `.gitignore`). Tus claves son privadas.

---

## Despliegue en VPS / Servidor (Docker)

Si querés que el bot de Telegram corra 24/7 en un servidor sin tener tu PC encendida:

```bash
# 1. Cloná el repo en tu VPS
git clone https://github.com/getodevel/PESOS.git
cd PESOS

# 2. Creá tu .env.local con los tokens
cp .env.local.example .env.local
nano .env.local

# 3. Levantá todo con Docker Compose
docker compose up -d --build
```

El contenedor levanta el servidor Next.js en el puerto `3000` y el daemon del bot de Telegram en segundo plano. La base de datos SQLite se persiste en un volumen local.

---

## Guía de Desarrollo Local

Si querés modificar o contribuir al código:

### Prerequisitos

- **Node.js** 20 o superior → [nodejs.org](https://nodejs.org)
- **npm** 10+ (incluido con Node.js)

```bash
# Verificar versiones
node -v  # debe ser >= 20
npm -v   # debe ser >= 10
```

### Setup

```bash
# 1. Clonar el repo
git clone https://github.com/getodevel/PESOS.git
cd PESOS

# 2. Instalar dependencias
npm install

# 3. Reconstruir bindings nativos de SQLite para tu entorno
npm rebuild better-sqlite3

# 4. Crear variables de entorno
cp .env.local.example .env.local
# Editá .env.local con tus tokens

# 5. Correr en modo desarrollo
npm run dev          # Levanta el servidor Next.js en localhost:3000
npm run electron     # (en otra terminal) Abre la ventana de Electron

# 6. Correr tests
npm run test
```

### Empaquetar instaladores

```bash
# Buildear Next.js primero
npm run build

# Empaquetar para tu plataforma actual
npm run electron-pack
# Los instaladores quedan en ./dist/
```

---

## Arquitectura

```
PESOS/
├── electron.js          # Proceso principal de Electron (ventana + Telegram polling)
├── scripts/
│   └── bot-daemon.js    # Daemon standalone del bot (para Docker/VPS)
├── src/
│   ├── app/             # Rutas y páginas Next.js
│   │   └── api/         # API Routes (SQLite, Telegram, IA)
│   └── lib/
│       └── sqlite-db.ts # Interfaz directa con la base de datos local
├── Dockerfile           # Para despliegue en servidor
└── install.sh           # Script de instalación automática (Linux)
```

**Base de datos:** Los datos se guardan en `~/.config/pesos/pesos.db` (SQLite local).

---

## Licencia

MIT — Hacé lo que quieras con el código. Si lo mejorás, ¡compartí de vuelta!
