# Proxy en Cloudflare Pages

Puerta de entrada para servir Tex AI desde un servidor propio expuesto con Tailscale Funnel.

- **Estáticos desde Cloudflare:** `_next/static`, favicon y logos se sirven desde Pages; al servidor solo llegan el HTML y `/api/*`.
- **Plan B:** si el servidor no responde en 5 s (12 s para la API) o el Funnel devuelve 502/503/504/52x, entrega `offline.html` (el prerender de la página) y la API responde `503 {"maintenance": true}`. El modo público sigue funcionando.
- **Vista previa del link:** los bots de WhatsApp, LinkedIn, etc. reciben la copia estática, que ya tiene título, descripción e imagen.
- **Actividad:** visitas, consultas frecuentes probadas y vistas previas del link se guardan en un namespace de KV (sin cookies ni IPs; ciudad, país y dispositivo). `GET /api/_activity` las devuelve solo si la cookie de sesión es válida en el servidor.

## Despliegue

```bash
npx wrangler kv namespace create tex-ai-events      # copiá el id en wrangler.toml
mkdir -p public/_next
cp _worker.js public/
cp -r ../../.next/static public/_next/static
cp ../../public/* public/
cp ../../.next/server/app/index.html public/offline.html
npx wrangler pages deploy public --project-name <tu-proyecto> --branch main
```

Editá `ORIGEN` en `_worker.js` con la URL de tu Funnel. El worker no contiene claves.
