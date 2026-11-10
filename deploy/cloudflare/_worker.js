// Proxy de Cloudflare Pages: tex-ai-app.pages.dev -> Tex AI en el homelab (Tailscale Funnel).
// No contiene claves: es código público.
const ORIGEN = "https://tu-servidor.tu-tailnet.ts.net:10000"; // URL de tu Tailscale Funnel, sin barra final

// Archivos estáticos que sirve Cloudflare directamente (se suben junto con este worker
// en cada deploy). Así el server de casa solo atiende el HTML y la API.
const ESTATICOS = /^\/(_next\/static\/|favicon\.ico$|icon\.png$|og\.png$|tex-[\w-]+\.(png|jpg)$)/;

// Si el server no responde en este tiempo (o el Funnel devuelve error), se usa el plan B.
const TIMEOUT_PAGINA_MS = 5000;
const TIMEOUT_API_MS = 12000;
const CAIDO = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]);

const BOTS_PREVIEW = /(facebookexternalhit|whatsapp|linkedinbot|slackbot|twitterbot|telegrambot|discordbot|skypeuripreview|googlebot|bingbot|embedly|quora|pinterest|redditbot|applebot)/i;

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function servirEstatico(env, request, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, request.url), { method: "GET" }));
  if (res.status >= 300 && res.status < 400 && res.headers.get("Location")) {
    return env.ASSETS.fetch(new Request(new URL(res.headers.get("Location"), request.url), { method: "GET" }));
  }
  return res;
}

// Copia de la página guardada en cada deploy: el modo público funciona sin el server.
async function paginaOffline(env, request) {
  let res = await servirEstatico(env, request, "/offline");
  if (res.status !== 200) res = await servirEstatico(env, request, "/offline.html");
  const r = new Response(res.body, res);
  r.headers.set("Content-Type", "text/html; charset=utf-8");
  r.headers.set("Cache-Control", "no-store");
  r.headers.set("X-Tex-Offline", "1");
  return r;
}

// ---------- Registro de actividad (sin cookies ni IPs) ----------
function describirCliente(request) {
  const ua = request.headers.get("User-Agent") || "";
  const cf = request.cf || {};
  let referer = "";
  try {
    const ref = request.headers.get("Referer");
    if (ref) referer = new URL(ref).hostname;
  } catch {}
  return {
    country: cf.country || "",
    city: cf.city || "",
    region: cf.region || "",
    device: /mobile|android|iphone|ipad/i.test(ua) ? "móvil" : "escritorio",
    browser: (ua.match(/(Edg|OPR|Chrome|Firefox|Safari)\/[\d]+/) || [""])[0].replace("Edg", "Edge").replace("OPR", "Opera"),
    referer,
  };
}

async function registrar(env, evento) {
  if (!env.EVENTS) return;
  const t = Date.now();
  const key = `e:${String(9999999999999 - t).padStart(13, "0")}:${Math.random().toString(36).slice(2, 8)}`;
  const meta = { t, ...evento };
  // los datos van en la metadata (≤1 KB) para leer todo con una sola llamada a list()
  await env.EVENTS.put(key, "", { metadata: meta, expirationTtl: 60 * 60 * 24 * 120 });
}

async function sesionValida(request) {
  try {
    const res = await fetch(new URL("/api/auth", ORIGEN), {
      headers: { Cookie: request.headers.get("Cookie") || "" },
      signal: AbortSignal.timeout(TIMEOUT_API_MS),
    });
    if (!res.ok) return false;
    return Boolean((await res.json()).authenticated);
  } catch {
    return false;
  }
}

async function manejarActividad(request, env, ctx, url) {
  if (url.pathname === "/api/_evt" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {}
    const tipos = new Set(["visit", "faq", "login", "chat"]);
    if (!tipos.has(body.type)) return json({ ok: false }, 400);
    const evento = {
      type: body.type,
      vid: String(body.vid || "").slice(0, 12),
      faq: body.type === "faq" ? String(body.faq || "").slice(0, 60) : undefined,
      offline: body.offline ? 1 : undefined,
      logged: body.logged ? 1 : undefined,
      ...describirCliente(request),
    };
    ctx.waitUntil(registrar(env, evento));
    return json({ ok: true });
  }
  if (url.pathname === "/api/_activity" && request.method === "GET") {
    if (!(await sesionValida(request))) return json({ error: "No autorizado" }, 401);
    const list = await env.EVENTS.list({ prefix: "e:", limit: 500 });
    return json({ events: list.keys.map((k) => k.metadata).filter(Boolean) });
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const esGet = request.method === "GET" || request.method === "HEAD";

    if (esGet && ESTATICOS.test(url.pathname)) {
      const estatico = await servirEstatico(env, request, url.pathname);
      if (estatico.status === 200) {
        const r = new Response(estatico.body, estatico);
        if (url.pathname.startsWith("/_next/static/")) {
          r.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        }
        return r;
      }
    }

    if (url.pathname.startsWith("/api/_")) {
      const res = await manejarActividad(request, env, ctx, url);
      if (res) return res;
    }

    const esApi = url.pathname.startsWith("/api/");
    const esPagina = esGet && !esApi && (request.headers.get("Accept") || "").includes("text/html");

    // Vistas previas del link (WhatsApp, LinkedIn, etc.): se registran y se sirve la copia estática,
    // que ya tiene título, descripción e imagen, sin depender del server.
    const ua = request.headers.get("User-Agent") || "";
    if (esGet && !esApi && BOTS_PREVIEW.test(ua)) {
      ctx.waitUntil(registrar(env, { type: "preview", bot: (ua.match(BOTS_PREVIEW) || [""])[0], ...describirCliente(request) }));
      if (url.pathname === "/") return paginaOffline(env, request);
    }

    const destino = new URL(url.pathname + url.search, ORIGEN);
    const pedido = new Request(destino, request);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) pedido.headers.set("X-Forwarded-For", ip);
    pedido.headers.set("X-Forwarded-Proto", "https");
    pedido.headers.set("X-Forwarded-Host", url.host);

    let respuesta;
    try {
      // el timeout corta solo la espera de los encabezados; el streaming del chat sigue normal
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), esPagina ? TIMEOUT_PAGINA_MS : TIMEOUT_API_MS);
      try {
        respuesta = await fetch(pedido, { redirect: "manual", signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }
      if (CAIDO.has(respuesta.status)) throw new Error(`origen ${respuesta.status}`);
    } catch {
      if (esPagina) return paginaOffline(env, request);
      if (esApi) {
        return json(
          { error: "El servidor está en mantenimiento, probá en unos minutos.", maintenance: true },
          503,
          { "Retry-After": "120" }
        );
      }
      return new Response("El servidor no responde. Probá de nuevo en unos minutos.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Si la app redirige a su URL de Funnel, la reescribimos para seguir en pages.dev
    const location = respuesta.headers.get("Location");
    if (location && location.startsWith(ORIGEN)) {
      const r = new Response(respuesta.body, respuesta);
      r.headers.set("Location", location.slice(ORIGEN.length) || "/");
      return r;
    }
    return respuesta;
  },
};
