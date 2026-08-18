// Escucha el mensaje en vivo que escribes desde admin.html y lo entrega a
// script.js a través de window.liveMessage. Si Firebase no está configurado
// todavía (firebase-config.js sigue con los valores de plantilla) o falla
// la conexión, esto simplemente no hace nada — el countdown sigue
// funcionando normal con los mensajes automáticos por días.
import { firebaseConfig } from "./firebase-config.js";

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const { getFirestore, doc, onSnapshot } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    onSnapshot(
      doc(db, "love", "latest"),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        window.liveMessage = data && data.text ? data.text : null;
        window.liveMessageAt = data && data.sentAt ? data.sentAt.toDate() : null;
      },
      (err) => {
        console.warn("Mensaje en vivo no disponible, usando el mensaje automático:", err);
        window.liveMessage = null;
      }
    );
  } catch (err) {
    console.warn("No se pudo conectar con Firebase, usando el mensaje automático:", err);
  }
}
