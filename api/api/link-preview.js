// Cuando un mensaje trae un link, el navegador le pide a esta función que
// vaya a ver esa página y traiga su título, descripción y miniatura (las
// mismas etiquetas "og:" que usa cualquier vista previa de WhatsApp o
// iMessage). Hace falta que corra en el servidor porque los navegadores no
// dejan que una página le pida directamente el HTML a otra página de otro
// sitio (CORS).
//
// Si el sitio de destino bloquea esto, tarda demasiado, o no tiene esas
// etiquetas, simplemente no hay vista previa rica y el link se queda como
// un link normal — nunca rompe el mensaje.

const BLOCKED_HOSTS = /(^localhost$|^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.0\.0\.0$|\.local$)/i;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) {
    return Response.json({ error: "Falta el parámetro url." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "URL inválida." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "Protocolo no permitido." }, { status: 400 });
  }
  if (BLOCKED_HOSTS.test(parsed.hostname)) {
    return Response.json({ error: "Host no permitido." }, { status: 400 });
  }

  const fallback = { url: parsed.toString(), siteName: safeHostname(parsed) };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://vercel.com)",
          Accept: "text/html",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return Response.json(fallback);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return Response.json(fallback);

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) return Response.json(fallback);

    const html = await res.text();
    const pick = (re) => {
      const m = html.match(re);
      return m ? decodeEntities(m[1].trim()) : null;
    };

    const title =
      pick(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i) ||
      pick(/<title[^>]*>([^<]*)<\/title>/i);

    const description =
      pick(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:description["']/i) ||
      pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);

    let image =
      pick(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
      pick(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:image["']/i);

    if (image && !/^https?:\/\//i.test(image)) {
      try {
        image = new URL(image, parsed).toString();
      } catch {
        image = null;
      }
    }

    return Response.json(
      {
        url: parsed.toString(),
        siteName: safeHostname(parsed),
        title: title || safeHostname(parsed),
        description,
        image: image || null,
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (err) {
    return Response.json(fallback);
  }
}

function safeHostname(url) {
  return url.hostname.replace(/^www\./, "");
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
