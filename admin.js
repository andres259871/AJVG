import { firebaseConfig } from "./firebase-config.js";
import { buildMessageNode, initComposer, initLightbox } from "./media.js";

const els = {
  loginView: document.getElementById("loginView"),
  writeView: document.getElementById("writeView"),
  loginForm: document.getElementById("loginForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginError: document.getElementById("loginError"),
  writeForm: document.getElementById("writeForm"),
  text: document.getElementById("text"),
  count: document.getElementById("count"),
  photoBtn: document.getElementById("photoBtn"),
  photoInput: document.getElementById("photoInput"),
  micBtn: document.getElementById("micBtn"),
  recIndicator: document.getElementById("recIndicator"),
  recTime: document.getElementById("recTime"),
  attachPreview: document.getElementById("attachPreview"),
  attachImg: document.getElementById("attachImg"),
  attachAudio: document.getElementById("attachAudio"),
  attachDiscard: document.getElementById("attachDiscard"),
  sendBtn: document.getElementById("sendBtn"),
  sendStatus: document.getElementById("sendStatus"),
  lastMessage: document.getElementById("lastMessage"),
  anneLastMessage: document.getElementById("anneLastMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
};

initLightbox();

// Solo intentamos cargar Firebase si firebase-config.js ya tiene datos
// reales — así, mientras no lo hayas configurado, este panel no dispara
// ni una sola llamada de red y muestra el aviso al instante.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "TU_API_KEY") {
  els.loginView.innerHTML =
    '<p class="kicker">Falta configurar</p>' +
    '<p style="color:var(--ink-dim); font-size:14px; line-height:1.6;">' +
    "Este panel todavía no está conectado a Firebase. Completa " +
    "<code>firebase-config.js</code> con los datos de tu proyecto (ver el " +
    "README) y vuelve a publicar." +
    "</p>";
} else {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    const { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } =
      await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const messagesRef = collection(db, "messages");

    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.loginError.hidden = true;
      try {
        await signInWithEmailAndPassword(auth, els.email.value.trim(), els.password.value);
      } catch (err) {
        els.loginError.textContent = "No entró — revisa el correo y la contraseña.";
        els.loginError.hidden = false;
      }
    });

    els.logoutBtn.addEventListener("click", () => signOut(auth));

    els.text.addEventListener("input", () => {
      els.count.textContent = String(els.text.value.length);
    });

    onAuthStateChanged(auth, (user) => {
      els.loginView.hidden = !!user;
      els.writeView.hidden = !user;
    });

    onSnapshot(
      query(messagesRef, orderBy("sentAt", "desc"), limit(40)),
      (snap) => {
        let lastAndres = null;
        let lastAnne = null;
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
          if (!lastAndres && data.from === "andres") lastAndres = entry;
          if (!lastAnne && data.from === "anne") lastAnne = entry;
        });

        els.lastMessage.innerHTML = "";
        els.lastMessage.appendChild(
          lastAndres ? buildMessageNode(lastAndres) : textNode("Todavía no has enviado nada.")
        );

        els.anneLastMessage.innerHTML = "";
        els.anneLastMessage.appendChild(
          lastAnne ? buildMessageNode(lastAnne) : textNode("Todavía no te ha escrito nada.")
        );
      },
      (err) => console.warn("No se pudieron cargar los mensajes:", err)
    );

    initComposer({
      form: els.writeForm,
      textEl: els.text,
      photoBtn: els.photoBtn,
      photoInput: els.photoInput,
      micBtn: els.micBtn,
      recIndicator: els.recIndicator,
      recTime: els.recTime,
      attachPreview: els.attachPreview,
      attachImg: els.attachImg,
      attachAudio: els.attachAudio,
      attachDiscard: els.attachDiscard,
      sendBtn: els.sendBtn,
      statusEl: els.sendStatus,
      onSend: async ({ text, type, mediaUrl }) => {
        const doc = { text, from: "andres", sentAt: serverTimestamp() };
        if (type !== "text") {
          doc.type = type;
          doc.mediaUrl = mediaUrl;
        }
        await addDoc(messagesRef, doc);
        els.count.textContent = "0";
      },
    });
  } catch (err) {
    els.loginError.textContent = "No se pudo cargar Firebase. Revisa tu conexión e inténtalo de nuevo.";
    els.loginError.hidden = false;
    console.warn(err);
  }
}

function textNode(text) {
  const p = document.createElement("p");
  p.className = "msg-text";
  p.textContent = text;
  return p;
}
