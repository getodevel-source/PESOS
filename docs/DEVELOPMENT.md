# Guía de Desarrollo y Despliegue

## Requisitos Previos

- **Node.js** 20 o superior
- **npm** 10 o superior

---

## Desarrollo Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/getodevel-source/PESOS.git
   cd PESOS
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Reconstruir dependencias nativas:**
   Como usamos SQLite local (`better-sqlite3`), debés compilar los bindings nativos para tu versión actual de Node:
   ```bash
   npm rebuild better-sqlite3
   ```

4. **Correr la aplicación:**
   Debés levantar el servidor Next.js y luego la ventana de Electron en terminales separadas:
   ```bash
   # Terminal 1: Servidor web
   npm run dev

   # Terminal 2: Ventana de escritorio
   npm run electron
   ```

5. **Correr pruebas:**
   ```bash
   npm run test
   ```

---

## Empaquetado de Instaladores

Para generar los instaladores de producción (`.exe`, `.deb`, `.AppImage`, etc.):

```bash
# 1. Compilar Next.js
npm run build

# 2. Generar empaquetado final
npm run electron-pack
```

Los binarios resultantes se guardarán en el directorio `./dist/`.

---

## Despliegue en VPS (Docker)

Si preferís correr el sistema 24/7 en un servidor remoto o VPS para que el bot de Telegram siempre responda:

1. **Configurar variables:**
   Crea un archivo `.env.local` en la raíz del proyecto.
   
2. **Levantar contenedores:**
   ```bash
   docker compose up -d --build
   ```

Esto levantará el servidor en el puerto `3000` usando SQLite persistido en un volumen y mantendrá el daemon del bot de Telegram en ejecución constante.
