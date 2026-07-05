# 06-deployment — Despliegue y Distribución

## Propósito
Describe las distintas modalidades de ejecución, el proceso de compilación y empaquetado de instaladores de escritorio, y el despliegue del sistema en servidores VPS mediante contenedores Docker.

## Responsabilidades
- **Entorno de Desarrollo**: Provee un entorno de recarga rápida (HMR) ejecutando el servidor de desarrollo de Next.js y abriendo la ventana de Electron de forma paralela.
- **Compilador (`electron-builder`)**: Compila el código frontend estático, elimina dependencias de desarrollo y empaqueta ejecutables nativos para Linux, Windows y macOS.
- **Sistema de Actualización Automática (In-App Updater)**: Verifica actualizaciones contra el repositorio público de GitHub Releases y descarga e instala parches de forma transparente.
- **Docker Compose (Headless Deploy)**: Permite levantar la infraestructura del servidor de forma desatendida 24/7 para el bot de Telegram en VPS linux.

## Dependencias
- **Desarrollo**: Node.js v20+, npm v10+, bindings nativos compilados de `better-sqlite3`.
- **Empaquetado**: `electron-builder` en modo local, requiriendo dependencias nativas del sistema de destino (`libnss3`, `libatk1.0-0`, etc. en distribuciones basadas en Debian/Ubuntu).
- **Despliegue Docker**: Docker Engine, Docker Compose.

## Restricciones conocidas
- **Code Signing Ausente**: Los ejecutables generados para Windows (`.exe`) y macOS (`.app` / `.zip`) no poseen firmas digitales válidas de desarrollador.
  - En Windows: Salta la pantalla de alerta de Microsoft SmartScreen ("Windows protegió su PC") la primera vez.
  - En macOS: macOS Gatekeeper bloquea la app ("no se puede abrir porque el desarrollador no se puede verificar"). El usuario debe forzar la apertura vía clic derecho o quitando la cuarentena mediante comandos `xattr`.
- **Instalación de FUSE en Linux**: La versión empaquetada como AppImage requiere que la distribución de Linux del usuario tenga instalada la biblioteca `fuse2` (o `libfuse2`), de lo contrario la aplicación de escritorio fallará al intentar montarse e iniciar.

## Decisiones arquitectónicas
1. **Actualización Automática Desacoplada**: El actualizador de Electron (`updater.js`) escribe estados atómicos en `update-state.json`. Esto permite que Next.js consulte el estado de la actualización y envíe señales para iniciar descargas o reinicios escribiendo peticiones en archivos específicos (`update-check-request`, `update-download-request`, etc.), evitando el acoplamiento directo de llamadas IPC de Electron.
2. **Docker de Doble Proceso (Entrypoint Script)**: El Dockerfile utiliza una imagen ligera basada en `node:20-alpine` y define un `entrypoint.sh` a medida que lanza el demonio del bot de Telegram (`bot-daemon.js`) en segundo plano antes de levantar el servidor web de Next.js en primer plano.

## Diagramas de Despliegue

### Flujo 1: Desarrollo y Empaquetado Local
```mermaid
graph TD
    DEV[Desarrollador / Código] -->|npm install| DEP[Instala Node Modules]
    DEP -->|npm rebuild better-sqlite3| BIN[Compila Bindings Nativos]
    
    subgraph Modo Desarrollo
        BIN -->|npm run dev| WEB_DEV[Next.js Dev Server]
        BIN -->|npm run electron| ELEC_DEV[Electron Window]
        ELEC_DEV -.->|Apunta a| WEB_DEV
    end
    
    subgraph Compilacion de Produccion
        BIN -->|npm run build| NEXT_BUILD[Compilación Next.js]
        NEXT_BUILD -->|npm run electron-pack| ELEC_PACK[electron-builder]
        ELEC_PACK -->|Genera Binarios en ./dist/| BINS[AppImage / DEB / EXE / ZIP]
    end
```

### Flujo 2: Despliegue Headless en Servidor (VPS)
```mermaid
graph TD
    RE_REPO[Repositorio GitHub] -->|git pull| VPS[Servidor VPS]
    
    subgraph Docker Infrastructure
        VPS -->|docker compose up --build -d| COMPOSE[Docker Compose]
        COMPOSE -->|Construye| IMG[Imagen Docker: node-alpine]
        IMG -->|Ejecuta entrypoint.sh| ENTRY[Entrypoint]
        
        ENTRY -->|Proceso 1: Background| DAEMON[node bot-daemon.js]
        ENTRY -->|Proceso 2: Foreground| NEXT_PROD[npm run start: Next.js 3000]
        
        DAEMON -->|POST local| NEXT_PROD
        COMPOSE -->|Persiste db local| VOL[(Volumen Docker: pesos.db)]
        NEXT_PROD --> VOL
        DAEMON --> VOL
    end
    
    DAEMON <-->|Long Polling| TG[Telegram Bot API]
```

## Pendientes de validación
- **Automatización CI/CD (GitHub Actions)**: Está **PENDIENTE DE VALIDACIÓN** la configuración de un pipeline de integración y despliegue continuo (CI/CD) automatizado a través de GitHub Actions que compile automáticamente las versiones para todas las plataformas, asocie las firmas (en caso de adquirir certificados) y publique directamente los instaladores finales en los assets de GitHub Releases ante tags de nuevas versiones.
- **Monitoreo de Procesos en Docker**: Validar si en caso de que el proceso secundario `bot-daemon.js` muera dentro del contenedor por un fallo crítico, el contenedor Docker de Next.js es capaz de reportarlo o reiniciarse automáticamente (actualmente el script `entrypoint.sh` no supervisa activamente el PID del bot tras lanzarlo).
