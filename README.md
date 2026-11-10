# OndaPilot Studio

Un estudio web para **una emisora online**. Proyecto propio de Juan Esteban Echeverri, desarrollado con apoyo de asistentes de IA.

## Alcance del MVP 0.2

- Biblioteca musical con carga de archivos de audio y reproducción de vista previa.
- Persistencia en la nube: D1 para programación y R2 para archivos de audio, aislados por el usuario autenticado.
- Modo local de respaldo con IndexedDB y localStorage si no hay backend disponible (por ejemplo en desarrollo sin autenticación).
- Playlists editables, con orden manual, configuración aleatoria y eliminación de pistas.
- Parrilla semanal con bloques recurrentes, visualización de días, franjas nocturnas y detección de solapes, incluidos los cruces de domingo a lunes.
- Campañas publicitarias con minutos previstos por hora y cálculo de duración de las cuñas.
- Cabina web de reproducción continua con playlist, salto de canciones, pausa, cambio automático de playlist conforme a la parrilla, rotación de respaldo y cuñas en cola (después de terminar la canción en curso).
- API de archivos con carga y streaming autenticado, incluyendo solicitudes de rango para reproducción en HTMLAudioElement.
- Monitor de AzuraCast de solo lectura, activable mediante configuración segura del servidor.
- Dashboard con métricas, cobertura semanal, franja actual y siguientes bloques.
- Exportación e importación de borradores en JSON, sin incluir binarios de audio.
- Interfaz responsive en español y zona horaria de programación `America/Bogota`.

Los títulos cargados por defecto son **registros ficticios**, sin audio. No se suministra contenido musical con copyright.

## Estado real de la emisión

**Esta versión ya reproduce archivos reales dentro de la cabina del navegador, pero todavía no es un servidor de emisión pública 24/7.** La reproducción se detiene cuando se cierra el navegador y no se transmite automáticamente a oyentes externos. La programación y los audios cargados en el Site autenticado se almacenan en D1/R2. En ejecución local sin identidad se usa el modo de respaldo del navegador.

Los archivos de audio deben ser propios o contar con autorización para reproducirlos.

## Integración de AzuraCast

El monitor de estado está implementado en `app/api/azuracast/route.ts`. Para habilitarlo, configura en el servidor (nunca en código del cliente):

```env
AZURACAST_BASE_URL=https://tu-estacion.example
AZURACAST_STATION_ID=1
AZURACAST_API_KEY=clave-opcional-para-instancias-privadas
```

La URL debe usar HTTPS. El monitor obtiene el estado y la canción actual mediante `/api/nowplaying/{station_id}` y muestra un reproductor del stream cuando la instancia proporciona un enlace HTTPS. No se ha implementado todavía la escritura de playlists/programación en AzuraCast, ya que esa etapa requiere verificar la versión y las credenciales de una instancia concreta.

## Datos y límites

- Solo usuarios autenticados pueden consultar o modificar sus datos mediante la API del Site.
- Cada archivo de audio puede tener hasta **25 MB**. Si la subida a la nube falla, se conserva localmente con aviso.
- Las canciones ficticias precargadas son metadatos de ejemplo y **no se pueden reproducir** hasta incorporar archivos reales.
- El respaldo JSON no incluye el contenido binario de audios.
- La cola de cuñas es una aproximación editorial: se inserta al terminar la canción, no interrumpe exactamente en el segundo definido.

Para llegar a un servicio real, habrá que incorporar:

1. Backend seguro con claves de AzuraCast almacenadas como secretos de servidor.
2. Sincronización verificable de archivos, playlists y horarios con la API de una estación AzuraCast.
3. Reproducción real con Liquidsoap e Icecast/SHOUTcast, operando en un servidor permanente.
4. Estados de sincronización, pruebas con una emisora de ensayo, fallback musical y política de errores.

## Desarrollo

Requiere Node.js moderno. En el checkout:

```bash
pnpm install
npm run db:migrate:local   # crea las tablas en la D1 local (una vez, o tras una migración nueva)
npm run dev
```

Stack: Vinext (Next.js sobre Vite), React y TypeScript, ejecutado como Cloudflare Worker.

### Estructura

El código está organizado en capas para que la app pueda pasar de Cloudflare a un servidor propio sin reescribir la lógica:

| Carpeta | Contenido |
|---|---|
| `domain/` | Reglas puras, sin React ni red: programación (`radio.ts`), cabina como máquina de estados (`player.ts`) y esquemas de validación zod (`schemas.ts`). |
| `application/` | Puertos (interfaces que la app necesita: repositorio, almacenamiento de audio, auth, motor de emisión) y utilidades HTTP puras. |
| `infrastructure/` | Adaptadores concretos: D1 y R2 (`cloudflare/`), autenticación, AzuraCast y almacenamiento del navegador. |
| `server/` | `container.ts` elige los adaptadores; es el único lugar que cambia al migrar de hosting. |
| `app/` | Interfaz y rutas `/api/radio`, `/api/audio`, `/api/azuracast`, que solo autentican, validan y llaman a los puertos. |

Las vinculaciones `DB` (D1) y `BUCKET` (R2) se toman de `.openai/hosting.json` si existe (no está en el repo); si no, se usan esos nombres por defecto. Las migraciones de esquema están en `drizzle/`.

### Verificación

```bash
npm test          # dominio, cabina, validación y rangos HTTP
npx tsc --noEmit  # tipos
```

## Próximo hito

Conectar una instancia de prueba de AzuraCast de una sola emisora con un backend que haga proxy de la API. Primero leer estado y bibliotecas, luego aplicar cambios de playlists, horarios y campañas con confirmación de sincronización. **Nunca exponer la API key en el cliente**.

Documentación: https://azuracast.com/docs/developers/apis/ y https://azuracast.com/docs/user-guide/playlists/.
