# LÜMI — Your music. Your flow.

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


**Limitaciones de Spotify:** el Web Playback SDK requiere Spotify Premium y autorización del usuario. El acceso en modo desarrollo puede estar limitado por las reglas vigentes de Spotify y por la lista de usuarios permitidos de la aplicación. Tener Client ID no garantiza que todos los visitantes puedan reproducir Spotify. Revisa los requisitos actuales del panel de desarrolladores.

### YouTube:


 Algunos videos pueden impedir la reproducción incrustada o no estar disponibles en ciertos territorios.

