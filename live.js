// Conecta la página principal a Firebase: muestra los mensajes de Andrés y
// de Anne en sus columnas (texto, fotos, audios y vistas previas de links),
// y deja que Anne escriba directo desde aquí, sin login ni app — solo
// necesita tener este link abierto.
//
// Si Firebase no está configurado todavía (firebase-config.js sigue con
// los valores de plantilla) o algo falla, esto simplemente no hace nada:
// el countdown y el mensaje automático siguen funcionando igual, y las
// columnas se quedan mostrando "todavía nada por aquí".
import { firebaseConfig } from "./firebase-config.js";
import { renderColumn, initComposer, initLightbox } from "./media.js";

const els = {
  andresList: document.getElementById("andresList"),
  anneList: document.getElementById("anneList"),
  composeForm: document.getElementById("composeForm"),
  composeText: document.getElementById("composeText"),
  photoBtn: document.getElementById("photoBtn"),
  photoInput: document.getElementById("photoInput"),
  micBtn: document.getElementById("micBtn"),
  recIndicator: document.getElementById("recIndicator"),
  recTime: document.getElementById("recTime"),
  attachPreview: document.getElementById("attachPreview"),
  attachImg: document.getElementById("attachImg"),
  attachAudio: document.getElementById("attachAudio"),
  attachDiscard: document.getElementById("attachDiscard"),
  composeBtn: document.getElementById("composeBtn"),
  composeStatus: document.getElementById("composeStatus"),
};

const MAX_PER_COLUMN = 8;

initLightbox();

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const { getAuth, signInAnonymously } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    const { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } =
      await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const messagesRef = collection(db, "messages");

    onSnapshot(
      query(messagesRef, orderBy("sentAt", "desc"), limit(40)),
      (snap) => {
        const andres = [];
        const anne = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data) return;
          const entry = {
            text: data.text || "",
            type: data.type || "text",
            mediaUrl: data.mediaUrl || null,
            sentAt: data.sentAt ? data.sentAt.toDate() : null,
          };
          if (entry.type === "text" && !entry.text) return;
          if (data.from === "andres" && andres.length < MAX_PER_COLUMN) andres.push(entry);
          else if (data.from === "anne" && anne.length < MAX_PER_COLUMN) anne.push(entry);
        });
        renderColumn(els.andresList, andres);
        renderColumn(els.anneList, anne);
      },
      (err) => {
        console.warn("No se pudieron cargar los mensajes:", err);
      }
    );

    // Firma anónima e invisible: no le pide nada a Anne, solo habilita que
    // pueda escribir (las reglas de Firestore exigen alguna sesión, aunque
    // sea anónima, para evitar que cualquiera que encuentre el link pueda
    // escribir sin siquiera abrir la página).
    signInAnonymously(auth)
      .then(() => {
        els.composeBtn.disabled = false;
      })
      .catch((err) => {
        console.warn("No se pudo preparar el envío de mensajes:", err);
      });

    initComposer({
      form: els.composeForm,
      textEl: els.composeText,
      photoBtn: els.photoBtn,
      photoInput: els.photoInput,
      micBtn: els.micBtn,
      recIndicator: els.recIndicator,
      recTime: els.recTime,
      attachPreview: els.attachPreview,
      attachImg: els.attachImg,
      attachAudio: els.attachAudio,
      attachDiscard: els.attachDiscard,
      sendBtn: els.composeBtn,
      statusEl: els.composeStatus,
      onSend: async ({ text, type, mediaUrl }) => {
        const doc = { text, from: "anne", sentAt: serverTimestamp() };
        if (type !== "text") {
          doc.type = type;
          doc.mediaUrl = mediaUrl;
        }
        await addDoc(messagesRef, doc);
      },
    });
  } catch (err) {
    console.warn("No se pudo conectar con Firebase, la página sigue funcionando sin mensajes en vivo:", err);
  }
}
