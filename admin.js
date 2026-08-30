import { firebaseConfig } from "./firebase-config.js";

const els = {
  loginView: document.getElementById("loginView"),
  writeView: document.getElementById("writeView"),
  loginForm: document.getElementById("loginForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginError: document.getElementById("loginError"),
  text: document.getElementById("text"),
  count: document.getElementById("count"),
  sendBtn: document.getElementById("sendBtn"),
  sendStatus: document.getElementById("sendStatus"),
  lastText: document.getElementById("lastText"),
  lastMeta: document.getElementById("lastMeta"),
  anneLastText: document.getElementById("anneLastText"),
  anneLastMeta: document.getElementById("anneLastMeta"),
  logoutBtn: document.getElementById("logoutBtn"),
};

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

    const relativeTime = (date) => {
      const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMin < 1) return "justo ahora";
      if (diffMin < 60) return `hace ${diffMin} min`;
      const h = Math.floor(diffMin / 60);
      if (h < 24) return `hace ${h} h`;
      return `hace ${Math.floor(h / 24)} d`;
    };

    onSnapshot(
      query(messagesRef, orderBy("sentAt", "desc"), limit(40)),
      (snap) => {
        let lastAndres = null;
        let lastAnne = null;
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data || !data.text) return;
          if (!lastAndres && data.from === "andres") lastAndres = data;
          if (!lastAnne && data.from === "anne") lastAnne = data;
        });

        if (lastAndres) {
          els.lastText.textContent = lastAndres.text;
          els.lastMeta.textContent = lastAndres.sentAt ? relativeTime(lastAndres.sentAt.toDate()) : "";
        } else {
          els.lastText.textContent = "Todavía no has enviado nada.";
          els.lastMeta.textContent = "";
        }

        if (lastAnne) {
          els.anneLastText.textContent = lastAnne.text;
          els.anneLastMeta.textContent = lastAnne.sentAt ? relativeTime(lastAnne.sentAt.toDate()) : "";
        } else {
          els.anneLastText.textContent = "Todavía no te ha escrito nada.";
          els.anneLastMeta.textContent = "";
        }
      },
      (err) => console.warn("No se pudieron cargar los mensajes:", err)
    );

    els.sendBtn.addEventListener("click", async () => {
      const text = els.text.value.trim();
      if (!text) return;
      els.sendBtn.disabled = true;
      try {
        await addDoc(messagesRef, { text, from: "andres", sentAt: serverTimestamp() });
        els.text.value = "";
        els.count.textContent = "0";
        els.sendStatus.textContent = "Enviado.";
        els.sendStatus.hidden = false;
        setTimeout(() => (els.sendStatus.hidden = true), 2500);
      } catch (err) {
        els.sendStatus.textContent = "No se pudo enviar — inténtalo otra vez.";
        els.sendStatus.hidden = false;
      } finally {
        els.sendBtn.disabled = false;
      }
    });
  } catch (err) {
    els.loginError.textContent = "No se pudo cargar Firebase. Revisa tu conexión e inténtalo de nuevo.";
    els.loginError.hidden = false;
    console.warn(err);
  }
}
