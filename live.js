// Conecta la página principal a Firebase: muestra los mensajes de Andrés y
// de Anne en sus columnas, y deja que Anne escriba directo desde aquí, sin
// login ni app — solo necesita tener este link abierto.
//
// Si Firebase no está configurado todavía (firebase-config.js sigue con
// los valores de plantilla) o algo falla, esto simplemente no hace nada:
// el countdown y el mensaje automático siguen funcionando igual, y las
// columnas se quedan mostrando "todavía nada por aquí".
import { firebaseConfig } from "./firebase-config.js";

const els = {
  andresList: document.getElementById("andresList"),
  anneList: document.getElementById("anneList"),
  composeForm: document.getElementById("composeForm"),
  composeText: document.getElementById("composeText"),
  composeBtn: document.getElementById("composeBtn"),
  composeStatus: document.getElementById("composeStatus"),
};

const MAX_PER_COLUMN = 8;

function renderColumn(el, messages) {
  if (!messages.length) {
    el.innerHTML = '<p class="thread-empty">Todavía nada por aquí.</p>';
    return;
  }
  const relativeTime = window.relativeTime || (() => "");
  el.innerHTML = messages
    .map((m) => {
      const text = document.createElement("p");
      text.className = "msg-text";
      text.textContent = m.text;
      const meta = document.createElement("p");
      meta.className = "msg-meta";
      meta.textContent = m.sentAt ? relativeTime(m.sentAt) : "";
      const wrap = document.createElement("div");
      wrap.className = "msg";
      wrap.appendChild(text);
      wrap.appendChild(meta);
      return wrap.outerHTML;
    })
    .join("");
}

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
          if (!data || !data.text) return;
          const entry = { text: data.text, sentAt: data.sentAt ? data.sentAt.toDate() : null };
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

    els.composeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = els.composeText.value.trim();
      if (!text) return;
      els.composeBtn.disabled = true;
      els.composeStatus.hidden = true;
      try {
        await addDoc(messagesRef, { text, from: "anne", sentAt: serverTimestamp() });
        els.composeText.value = "";
        els.composeStatus.textContent = "Enviado.";
        els.composeStatus.hidden = false;
        setTimeout(() => (els.composeStatus.hidden = true), 2500);
      } catch (err) {
        els.composeStatus.textContent = "No se pudo enviar — inténtalo otra vez.";
        els.composeStatus.hidden = false;
        console.warn(err);
      } finally {
        els.composeBtn.disabled = false;
      }
    });
  } catch (err) {
    console.warn("No se pudo conectar con Firebase, la página sigue funcionando sin mensajes en vivo:", err);
  }
}
