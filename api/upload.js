// Recibe una foto o un audio ya listos (comprimidos/grabados en el navegador,
// ver media.js) y los guarda en Vercel Blob. Corre en Vercel, no en el
// navegador de nadie — por eso puede usar la dependencia @vercel/blob.
//
// No hace falta ninguna variable de entorno propia: en cuanto conectas un
// Blob store al proyecto desde el dashboard de Vercel (ver README), Vercel
// se encarga de dársela a esta función automáticamente.
import { put } from "@vercel/blob";

// Mismo límite real que impone Vercel a las funciones normales (por eso
// media.js comprime las fotos y limita las notas de voz a 3 minutos antes
// de llegar aquí).
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED = {
  photo: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
  audio: {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/aac": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
  },
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  }

  const kind = request.headers.get("x-kind");
  const contentTypeHeader = request.headers.get("content-type") || "";
  const contentType = contentTypeHeader.split(";")[0].trim();

  const table = ALLOWED[kind];
  if (!table || !table[contentType]) {
    return Response.json({ error: "Tipo de archivo no permitido." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) {
    return Response.json(
      { error: kind === "audio" ? "La nota de voz quedó muy larga." : "La foto pesa demasiado." },
      { status: 413 }
    );
  }

  const ext = table[contentType];
  const pathname = `${kind}s/${Date.now()}.${ext}`;

  try {
    const blob = await put(pathname, request.body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return Response.json({ url: blob.url });
  } catch (err) {
    console.error("upload failed", err);
    return Response.json({ error: "No se pudo subir el archivo." }, { status: 500 });
  }
}
