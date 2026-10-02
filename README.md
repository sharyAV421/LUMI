# LÜMI — Your music. Your flow.

## Enlaces del proyecto

**Aplicación desplegada:** https://lumi-one-eosin.vercel.app/

Reproductor musical  desarrollado en TypeScript. Organiza canciones  y ofrece integración con Spotify, YouTube y archivos de audio locales. 

## Funcionalidades


- Insertar canciones al inicio, en una posición intermedia o al final.
- Buscar videos musicales mediante YouTube Data API v3.
- Buscar canciones en Spotify e iniciar sesión con OAuth Authorization Code + PKCE.
- Reproducción mediante Spotify Web Playback SDK para cuentas y usuarios elegibles.
- Reproducción mediante el reproductor oficial de YouTube.
- Reproducción de archivos de audio locales.
- Controles de anterior/siguiente, reproducir/pausar, posición, volumen, aleatorio, repetición, favoritos, eliminar, limpiar, invertir y filtrar.
- Diseño adaptable a escritorio y móviles.


**Limitaciones de Spotify:** el Web Playback SDK requiere Spotify Premium y autorización del usuario. El acceso en modo desarrollo  esta limitado por las reglas vigentes de Spotify y por la lista de usuarios permitidos de la aplicación. 

### YouTube:


 Algunos videos pueden impedir la reproducción incrustada o no estar disponibles en ciertos territorios.

 ## Acceso a Spotify

LÜMI utiliza la API de Spotify y Spotify Web Playback SDK para realizar búsquedas y reproducir música.

Actualmente, la aplicación está configurada en **modo de desarrollo de Spotify**. En este modo, Spotify requiere que las cuentas utilizadas para realizar pruebas estén previamente autorizadas en la configuración de la aplicación.

Si Spotify no funciona al probar la aplicación desplegada, es porque la cuenta de Spotify utilizada debe  ser agregada como usuario autorizado y contar con membresía.

Las funciones de YouTube y la reproducción de archivos locales no requieren esta autorización de Spotify.

