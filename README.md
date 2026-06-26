# PESOS — Personal OS (Habits & Finances)

**PESOS** es un sistema operativo personal diseñado para centralizar tu productividad, hábitos, bitácora diaria y finanzas personales directamente en tu computadora local. Cuenta con integración nativa con un bot de Telegram con Inteligencia Artificial para interactuar con tus datos en lenguaje natural.

---

## Características Principales

* **📅 Vista General & Dashboard:** Control centralizado de tareas del día, recordatorios futuros, bitácora emocional y dietas.
* **🔄 Hábitos Diarios:** Seguimiento de hábitos diarios con cálculo de racha e impacto de XP al completarlos.
* **💰 Finanzas Personales:** Registro detallado de ingresos y gastos con conversión automática de Dólar MEP en Argentina para transacciones en USD.
* **⚔️ Sistema RPG de Gamificación:** Subí de nivel, ganá XP y desbloqueá logros a medida que cumplís con tu planificación diaria y te mantenés bajo presupuesto.
* **🤖 Bot de Telegram con IA ("Pesito"):** Agregá tareas, registrá gastos por voz o texto, y pedile resúmenes ejecutivos a través de IA (Gemini o DeepSeek/OpenCode) en español argentino informal.
* **🔒 Privacidad Local (SQLite):** Todos tus datos se guardan de forma local en tu máquina en una base de datos SQLite embebida, sin depender de servicios en la nube ni Docker obligatorios.

---

## Requisitos de Entorno (`.env.local`)

Para habilitar todas las funciones (especialmente la IA y el Bot de Telegram), creá un archivo `.env.local` en la raíz del proyecto con la siguiente estructura:

```bash
# Token del Bot de Telegram (Obtenido en BotFather)
TELEGRAM_BOT_TOKEN="tu-token-aqui"

# Proveedor de IA (Usar al menos uno)
GOOGLE_AI_API_KEY="tu-api-key-de-gemini"
OPENCODE_GO_API_KEY="tu-api-key-de-opencode"
```

---

## Instrucciones de Instalación por Sistema Operativo

### 🪟 Windows (Instalación con un clic)
1. Descargá el archivo ejecutable `PESOS Setup 0.1.0.exe` desde la carpeta `dist/`.
2. Hacé doble clic en el instalador.
3. La aplicación se instalará y abrirá automáticamente. 
4. **Ejecución en segundo plano:** Al cerrar la ventana principal con la **X**, la aplicación seguirá corriendo en segundo plano desde la bandeja del sistema (System Tray). Podés volver a abrirla o cerrarla por completo haciendo clic derecho sobre el ícono de PESOS en la barra de tareas.

### 🐧 Linux (Ejecución Portable)
1. Descargá el archivo `PESOS-0.1.0.AppImage` desde la carpeta `dist/`.
2. Dale permisos de ejecución al archivo:
   ```bash
   chmod +x PESOS-0.1.0.AppImage
   ```
3. Ejecutalo haciendo doble clic sobre él o desde la terminal:
   ```bash
   ./PESOS-0.1.0.AppImage
   ```

### 🍎 macOS
1. Descargá el archivo `PESOS-0.1.0-mac.zip` desde la carpeta `dist/` y descomprimilo.
2. Trasladá la aplicación `PESOS.app` a tu carpeta de `/Applications`.
3. Dado que el empaquetado para macOS requiere una firma y certificación oficial de Apple para saltarse los filtros de Gatekeeper, la primera vez que la abras tendrás que hacer **Clic derecho sobre la aplicación y seleccionar Abrir**, luego confirmar la ejecución en el menú de alerta de seguridad.
4. *Nota:* Para compilar la versión definitiva firmada y notarizada oficialmente, seguí las instrucciones en el archivo [MACOS_BUILD.md](file:///home/geto/Proyectos/PESOS/MACOS_BUILD.md).

---

## Despliegue en Servidores / VPS (Docker)

Si preferís desplegar **PESOS** en tu propio servidor Linux VPS para acceder a la aplicación mediante un navegador y dejar el bot de Telegram siempre activo en la nube:

1. Cloná este repositorio en tu VPS.
2. Creá tu archivo `.env.local` en el servidor con los tokens necesarios.
3. Ejecutá el levantamiento del contenedor:
   ```bash
   docker compose up -d --build
   ```
El contenedor se encargará de levantar automáticamente el servidor web de Next.js en el puerto `3000`, inicializará la base de datos SQLite y correrá en segundo plano el servicio `bot-daemon.js` encargado de escuchar al bot de Telegram mediante Long Polling de forma continua.

---

## Guía de Desarrollo Local

Si querés modificar el código y correr el proyecto en modo desarrollo:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```
2. **Reconstruir dependencias nativas (SQLite):**
   ```bash
   npm rebuild better-sqlite3
   ```
3. **Correr Next.js (Web):**
   ```bash
   npm run dev
   ```
4. **Correr Electron (Escritorio):**
   ```bash
   npm run electron
   ```
5. **Ejecutar Pruebas Unitarias:**
   ```bash
   npm run test
   ```
