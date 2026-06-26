# PESOS — Personal OS

> Tu sistema operativo personal para hábitos, finanzas y productividad diaria. Corre 100% local, sin la nube, con un bot de Telegram con IA incluido.

---

## ¿Qué hace PESOS?

| Módulo | Descripción |
|--------|-------------|
| 📅 **Dashboard** | Vista del día con tareas, recordatorios y bitácora emocional |
| 🔄 **Hábitos** | Seguimiento diario con rachas y sistema de XP |
| 💰 **Finanzas** | Ingresos, gastos y conversión automática ARS/USD (Dólar MEP) |
| ⚔️ **Gamificación RPG** | Subís de nivel, ganás logros y desbloqueás recompensas |
| 🤖 **Bot "Pesito"** | Telegram bot con IA para registrar gastos y tareas por voz o texto |
| 🔒 **100% Local** | SQLite embebida. Tus datos nunca salen de tu PC |

---

## Instalación

### 🐧 Linux — un solo comando

Detecta tu distribución automáticamente e instala el paquete correcto:

```bash
curl -fsSL https://raw.githubusercontent.com/getodevel-source/PESOS/main/install.sh | bash
```

<details>
<summary>¿Qué hace ese comando?</summary>

1. Detecta si usás Arch, Ubuntu/Debian u otra distro
2. Descarga el instalador correcto desde [GitHub Releases](https://github.com/getodevel-source/PESOS/releases/latest)
3. Lo instala con tu gestor de paquetes nativo
4. Crea el acceso directo en el menú de aplicaciones

</details>

#### Instalación manual por distro

Si preferís hacerlo paso a paso, descargá el archivo que corresponde desde [Releases](https://github.com/getodevel-source/PESOS/releases/latest):

| Distribución | Archivo | Comando |
|---|---|---|
| Arch, CachyOS, Manjaro, EndeavourOS | `.pacman` | `sudo pacman -U pesos-*.pacman` |
| Ubuntu, Debian, Mint, Pop!_OS | `.deb` | `sudo dpkg -i pesos_*_amd64.deb` |
| Cualquier distro (portable) | `.AppImage` | `chmod +x PESOS-*.AppImage && ./PESOS-*.AppImage` |

> **AppImage en Ubuntu 22.04+ / Arch:** si no abre, instalá `libfuse2`:
> ```bash
> sudo pacman -S libfuse2      # Arch/CachyOS
> sudo apt install libfuse2    # Ubuntu/Debian
> ```

---

### 🪟 Windows

Descargá el instalador `.exe` desde [Releases](https://github.com/getodevel-source/PESOS/releases/latest) y ejecutalo. La app se instala sola.

> Al cerrar la ventana con la ✕, PESOS sigue corriendo en segundo plano (bandeja del sistema). Para cerrarlo por completo: clic derecho en el ícono → **Salir**.

---

### 🍎 macOS

Descargá el `.zip` desde [Releases](https://github.com/getodevel-source/PESOS/releases/latest), descomprimí y mové `PESOS.app` a `/Applications`.

> Primera vez: **clic derecho → Abrir** para saltear la advertencia de Gatekeeper (app sin firma de Apple).
> Para compilar una versión firmada: ver [MACOS_BUILD.md](./MACOS_BUILD.md).

---

## Configuración inicial

La primera vez que abrís PESOS, aparece un **asistente de configuración** dentro de la misma app. Desde ahí podés ingresar:

- 🔑 **Google Gemini API Key** — [obtener gratis](https://aistudio.google.com/app/apikey)
- 🔑 **OpenCode API Key** — alternativa a Gemini
- 🤖 **Telegram Bot Token** — para usar el bot "Pesito" (opcional)

Todo se guarda localmente. No hay registro ni cuenta requerida.

---

## Despliegue en VPS (Docker)

Para que el bot de Telegram corra 24/7 en un servidor sin tener tu PC encendida:

```bash
git clone https://github.com/getodevel-source/PESOS.git && cd PESOS
# Configurá tus claves en .env.local (el asistente también funciona desde el navegador)
docker compose up -d --build
```

---

## Desarrollo local

```bash
git clone https://github.com/getodevel-source/PESOS.git
cd PESOS
npm install
npm rebuild better-sqlite3   # bindings nativos de SQLite
npm run dev                  # Next.js en localhost:3000
npm run electron             # ventana Electron (en otra terminal)
npm run test                 # tests unitarios
```

> **Requisitos:** Node.js 20+ y npm 10+
