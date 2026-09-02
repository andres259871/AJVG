// Todo lo de fotos, audio y vista previa de links vive aquí, compartido
// entre index.html (vía live.js) y admin.html (vía admin.js), para no tener
// la misma lógica escrita dos veces en dos archivos distintos.

const MAX_AUDIO_SECONDS = 180; // 3 minutos por nota de voz
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // el límite real de Vercel es 4.5MB por request

// --- 1. Comprimir la foto antes de subirla (más rápido de cargar para los
// dos, y se queda muy por debajo del límite de subida) ---
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    img.onload = () => {
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la foto."))),
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => reject(new Error("Ese archivo no parece una foto válida."));
    reader.readAsDataURL(file);
  });
}

// --- 2. Subir el archivo ya listo (foto comprimida o audio grabado) ---
export async function uploadMedia(blob, kind) {
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(kind === "audio" ? "La nota de voz quedó muy larga." : "La foto pesa demasiado.");
  }
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "X-Kind": kind,
    },
    body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo subir el archivo.");
  }
  const data = await res.json();
  return data.url;
}

// --- 3. Grabar una nota de voz ---
function pickAudioMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];
  return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickAudioMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    });
    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);
      this.mediaRecorder.addEventListener("stop", () => {
        const type = this.mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      });
      this.mediaRecorder.stop();
    });
  }
}

export const AUDIO_MAX_SECONDS = MAX_AUDIO_SECONDS;

// --- 4. Vista previa de links (con caché en memoria, para no repetir la
// misma consulta cada vez que la lista de mensajes se vuelve a pintar) ---
const URL_RE = /(https?:\/\/[^\s]+)/i;
const previewCache = new Map();

export function findUrl(text) {
  const m = text && text.match(URL_RE);
  return m ? m[1].replace(/[.,;:!?)]+$/, "") : null;
}

function fetchLinkPreview(url) {
  if (previewCache.has(url)) return previewCache.get(url);
  const promise = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  previewCache.set(url, promise);
  return promise;
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Misma lógica que script.js (que la usa para su propio "hace X"), pero
// no dependemos de ese archivo: admin.html no lo carga, así que la
// tenemos aquí también para que las fechas se vean igual en los dos lados.
function relativeTime(date) {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "justo ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// --- 5. Construir el HTML de un mensaje: texto (+ link si trae uno), foto
// o audio. Se usa tanto para las columnas de la página principal como para
// los "último mensaje" del panel privado. ---
export function buildMessageNode(m) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  const type = m.type || "text";

  if (type === "photo" && m.mediaUrl) {
    const photoWrap = document.createElement("div");
    photoWrap.className = "msg-photo";
    const img = document.createElement("img");
    img.src = m.mediaUrl;
    img.loading = "lazy";
    img.alt = m.text || "Foto";
    photoWrap.appendChild(img);
    wrap.appendChild(photoWrap);
    if (m.text) wrap.appendChild(captionNode(m.text));
  } else if (type === "audio" && m.mediaUrl) {
    const audioWrap = document.createElement("div");
    audioWrap.className = "msg-audio";
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = m.mediaUrl;
    audioWrap.appendChild(audio);
    wrap.appendChild(audioWrap);
    if (m.text) wrap.appendChild(captionNode(m.text));
  } else {
    const text = document.createElement("p");
    text.className = "msg-text";
    text.textContent = m.text || "";
    wrap.appendChild(text);

    const url = findUrl(m.text || "");
    if (url) wrap.appendChild(linkPreviewNode(url));
  }

  const meta = document.createElement("p");
  meta.className = "msg-meta";
  meta.textContent = m.sentAt ? relativeTime(m.sentAt) : "";
  wrap.appendChild(meta);

  return wrap;
}

function captionNode(text) {
  const p = document.createElement("p");
  p.className = "msg-text msg-caption";
  p.textContent = text;
  return p;
}

function linkPreviewNode(url) {
  const card = document.createElement("a");
  card.className = "link-preview";
  card.href = url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const domain = document.createElement("span");
  domain.className = "link-preview-domain";
  domain.textContent = safeHostname(url);
  card.appendChild(domain);

  fetchLinkPreview(url).then((data) => {
    if (!data || (!data.title && !data.image)) return;
    card.textContent = "";
    if (data.image) {
      const img = document.createElement("img");
      img.className = "link-preview-img";
      img.src = data.image;
      img.loading = "lazy";
      img.alt = "";
      card.appendChild(img);
    }
    const body = document.createElement("div");
    body.className = "link-preview-body";
    const title = document.createElement("p");
    title.className = "link-preview-title";
    title.textContent = data.title || safeHostname(url);
    body.appendChild(title);
    const site = document.createElement("p");
    site.className = "link-preview-domain";
    site.textContent = data.siteName || safeHostname(url);
    body.appendChild(site);
    card.appendChild(body);
  });

  return card;
}

export function renderColumn(el, messages) {
  if (!messages.length) {
    el.innerHTML = '<p class="thread-empty">Todavía nada por aquí.</p>';
    return;
  }
  el.innerHTML = "";
  for (const m of messages) el.appendChild(buildMessageNode(m));
}

// --- 6. Lightbox: tocar una foto la abre en grande ---
export function initLightbox() {
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.hidden = true;
  const img = document.createElement("img");
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  document.addEventListener("click", (e) => {
    const target = e.target.closest(".msg-photo img");
    if (target) {
      img.src = target.src;
      overlay.hidden = false;
    } else if (e.target === overlay) {
      overlay.hidden = true;
    }
  });
}

// --- 7. La caja de escribir: adjuntar foto, grabar audio, enviar ---
export function initComposer(opts) {
  const {
    form,
    textEl,
    photoBtn,
    photoInput,
    micBtn,
    recIndicator,
    recTime,
    attachPreview,
    attachImg,
    attachAudio,
    attachDiscard,
    sendBtn,
    statusEl,
    onSend,
  } = opts;

  let pending = null; // { kind: 'photo'|'audio', blob }
  let recorder = null;
  let recTimer = null;
  let recStart = 0;

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    setTimeout(() => (statusEl.hidden = true), 2800);
  }

  function clearAttachment() {
    pending = null;
    if (attachPreview) attachPreview.hidden = true;
    if (attachImg) {
      attachImg.hidden = true;
      attachImg.src = "";
    }
    if (attachAudio) {
      attachAudio.hidden = true;
      attachAudio.src = "";
    }
  }

  function setPhotoAttachment(blob) {
    pending = { kind: "photo", blob };
    attachPreview.hidden = false;
    attachAudio.hidden = true;
    attachImg.hidden = false;
    attachImg.src = URL.createObjectURL(blob);
  }

  function setAudioAttachment(blob) {
    pending = { kind: "audio", blob };
    attachPreview.hidden = false;
    attachImg.hidden = true;
    attachAudio.hidden = false;
    attachAudio.src = URL.createObjectURL(blob);
  }

  if (attachDiscard) attachDiscard.addEventListener("click", clearAttachment);

  if (photoBtn && photoInput) {
    photoBtn.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      photoInput.value = "";
      if (!file) return;
      try {
        const compressed = await compressImage(file);
        setPhotoAttachment(compressed);
      } catch (err) {
        showStatus(err.message || "No se pudo procesar la foto.");
      }
    });
  }

  if (micBtn) {
    micBtn.addEventListener("click", async () => {
      if (recorder) {
        clearInterval(recTimer);
        recIndicator.hidden = true;
        micBtn.classList.remove("recording");
        const activeRecorder = recorder;
        recorder = null;
        const blob = await activeRecorder.stop();
        if (blob && blob.size > 0) setAudioAttachment(blob);
        return;
      }
      try {
        const newRecorder = new AudioRecorder();
        await newRecorder.start();
        recorder = newRecorder;
        micBtn.classList.add("recording");
        recIndicator.hidden = false;
        recStart = Date.now();
        recTimer = setInterval(() => {
          const secs = Math.floor((Date.now() - recStart) / 1000);
          recTime.textContent = formatTime(secs);
          if (secs >= AUDIO_MAX_SECONDS) micBtn.click(); // se detiene sola
        }, 250);
      } catch (err) {
        recorder = null;
        showStatus("No se pudo acceder al micrófono.");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textEl.value.trim();
    if (!text && !pending) return;
    sendBtn.disabled = true;
    try {
      let type = "text";
      let mediaUrl = null;
      if (pending) {
        mediaUrl = await uploadMedia(pending.blob, pending.kind);
        type = pending.kind;
      }
      await onSend({ text, type, mediaUrl });
      textEl.value = "";
      clearAttachment();
      showStatus("Enviado.");
    } catch (err) {
      showStatus(err.message || "No se pudo enviar — inténtalo otra vez.");
    } finally {
      sendBtn.disabled = false;
    }
  });
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
