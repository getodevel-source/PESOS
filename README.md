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

---

## 🛠️ Desarrollo Local / Servidores

Si querés correr el código fuente o montarlo 24/7 en un VPS, consultá la [Guía Completa de Desarrollo](./docs/DEVELOPMENT.md) o usá Docker:

```bash
docker compose up -d --build
```
