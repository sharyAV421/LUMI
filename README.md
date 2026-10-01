# LÜMI — Your music. Your flow.

Reproductor musical responsive desarrollado en TypeScript. Organiza canciones mediante una lista doblemente enlazada y ofrece integración con Spotify, YouTube y archivos de audio locales. El código de la aplicación está en inglés.

## Funcionalidades

- Lista doblemente enlazada con referencias `prev` y `next`.
- Insertar canciones al inicio, en una posición intermedia o al final.
- Buscar videos musicales mediante YouTube Data API v3.
- Buscar canciones en Spotify e iniciar sesión con OAuth Authorization Code + PKCE.
- Reproducción mediante Spotify Web Playback SDK para cuentas y usuarios elegibles.
- Reproducción mediante el reproductor oficial de YouTube.
- Reproducción de archivos de audio locales.
- Controles de anterior/siguiente, reproducir/pausar, posición, volumen, aleatorio, repetición, favoritos, eliminar, limpiar, invertir y filtrar.
- Diseño adaptable a escritorio y móviles.

## 1. Requisitos

- Node.js 20.19+ o 22.12+.
- Client ID de una aplicación creada en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- Clave de API de YouTube Data API v3 creada en [Google Cloud Console](https://console.cloud.google.com/).

## 2. Preparar credenciales

En la carpeta raíz del proyecto, crea un archivo llamado `.env` (sin `.txt`). Copia estas líneas y sustituye los valores de ejemplo por tus claves: \n
```env
VITE_SPOTIFY_CLIENT_ID=PEGA_AQUI_TU_CLIENT_ID
VITE_YOUTUBE_API_KEY=PEGA_AQUI_TU_API_KEY_DE_YOUTUBE
```

El archivo `.env` está excluido de Git por `.gitignore`. No incluyas un Spotify Client Secret en el frontend. La integración usa PKCE y no requiere Client Secret. No compartas claves privadas ni publiques archivos `.env`.

### Spotify: configuración exacta para desarrollo local

1. Abre [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) y entra en tu aplicación LÜMI.
2. En Settings, registra como Redirect URI exactamente: `http://127.0.0.1:5173/`
3. Guarda los cambios.
4. Ejecuta LÜMI y abre en el navegador exactamente `http://127.0.0.1:5173/` (no uses `localhost` mientras la URI registrada sea `127.0.0.1`).
5. Si cambias el puerto o la dirección local, registra la nueva URI exacta en Spotify.

Selecciona Web API y Web Playback SDK si el panel de Spotify pregunta qué APIs/SDKs planeas utilizar. Ads API, iOS y Android no son necesarios para la versión web académica.

**Limitaciones de Spotify:** el Web Playback SDK requiere Spotify Premium y autorización del usuario. El acceso en modo desarrollo puede estar limitado por las reglas vigentes de Spotify y por la lista de usuarios permitidos de la aplicación. Tener Client ID no garantiza que todos los visitantes puedan reproducir Spotify. Revisa los requisitos actuales del panel de desarrolladores.

### YouTube: configuración

1. En Google Cloud Console, crea o selecciona un proyecto.
2. Habilita **YouTube Data API v3**.
3. Crea una API key y colócala en `VITE_YOUTUBE_API_KEY` dentro de `.env`.
4. Restringe la clave a YouTube Data API v3 y configura restricciones de sitio web cuando corresponda. Para desarrollo local, autoriza `http://127.0.0.1:5173/*`.
5. Algunos videos pueden impedir la reproducción incrustada o no estar disponibles en ciertos territorios.

## 3. Instalar y ejecutar en Windows PowerShell

Abre esta carpeta en VS Code. En la terminal, ejecuta:

```powershell
npm.cmd install
npm.cmd run dev
```

Después abre `http://127.0.0.1:5173/` en el navegador. Si Vite informa otra dirección o puerto, detén el servidor y verifica la configuración para que coincida con la Redirect URI registrada en Spotify. Si editas `.env` con el servidor encendido, deténlo con `Ctrl+C` y vuelve a ejecutar `npm.cmd run dev`.

## 4. Comprobar compilación

```powershell
npm.cmd run build
npm.cmd run preview
```

## 5. Publicar en Vercel

1. Sube el proyecto a tu repositorio de GitHub.
2. Importa ese repositorio en Vercel o utiliza el proyecto Vercel existente si ya está conectado. No crees otro proyecto si quieres conservar la URL actual.
3. Framework Preset: **Vite**. Build Command: `npm run build`. Output Directory: `dist`.
4. En Project Settings → Environment Variables, configura `VITE_SPOTIFY_CLIENT_ID` y `VITE_YOUTUBE_API_KEY`.
5. En Spotify Developer, agrega la URL HTTPS de producción terminada en `/` como Redirect URI, por ejemplo `https://tu-proyecto.vercel.app/`. Usa tu URL real, no el ejemplo.
6. Ajusta las restricciones de la API key de YouTube para el dominio de producción.
7. Despliega de nuevo después de configurar las variables.

La URL de producción de Vercel debe coincidir exactamente con la Redirect URI de Spotify cuando se inicia sesión desde la versión publicada.

## Notas importantes

- Las claves `VITE_*` se incorporan al código del navegador y pueden ser visibles para visitantes. Restringe la API key de YouTube y nunca incluyas un Client Secret de Spotify en el frontend.
- Los archivos locales los selecciona cada visitante desde su propio dispositivo; no se cargan al servidor.
- La lista actual se mantiene en memoria y se reinicia al actualizar la página.
- Para iPhone, la interfaz web es adaptable; se puede abrir desde Safari. Esto no la convierte en una aplicación nativa de iOS.
