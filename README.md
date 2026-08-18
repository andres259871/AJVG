# Cuenta regresiva — 31 de diciembre

Página estática, sin backend ni membresías. Cuenta regresiva en vivo hasta el
**31 de diciembre de 2026, medianoche, hora de Madrid**. Diseño oscuro,
minimalista, con acentos dorados y un fondo de estrellas muy sutil.

Dos detalles vivos que ya trae:

- El mensaje de abajo cambia solo según cuánto falte (no es un texto fijo).
- El fondo sigue el sol real de Madrid — calcula la salida y puesta de sol
  del día (la misma cuenta que usa cualquier calendario de amanecer/
  atardecer) y va pasando de noche a amanecer, de amanecer a día claro, de
  día a atardecer y de vuelta a noche, en el momento exacto en que pasa allá.
  No son cuatro fondos que saltan cada cierta hora fija — es un degradado
  continuo que se recalcula cada minuto, así que se siente como un cielo
  real, no como un interruptor. El texto también cambia de claro a oscuro
  (y al revés) exactamente cuando hace falta para seguir leyéndose bien.

Un tercer detalle vivo, nuevo: puedes escribirle un mensaje desde tu
celular y le aparece solo en el suyo, en cuanto lo tenga abierto — sin
que ella haga nada. Ver "Mensajes en vivo" más abajo para conectarlo (es
gratis, toma unos 10 minutos, una sola vez).

## Archivos

- `index.html` — estructura y textos, la página que ve ella.
- `styles.css` — todo el diseño.
- `script.js` — la cuenta regresiva, los mensajes automáticos y el fondo.
- `live.js` — conecta `index.html` al mensaje en vivo (opcional: si no
  configuras Firebase, esto no hace nada y el sitio sigue funcionando igual).
- `admin.html` / `admin.css` / `admin.js` — tu panel privado para escribirle.
  No está enlazado desde ningún lado de `index.html` — solo tú tienes esa
  URL.
- `firebase-config.js` — los datos de tu proyecto de Firebase (ver más
  abajo). Sin configurar, `live.js` y `admin.js` simplemente no hacen nada.
- `manifest.json` + `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` / `favicon-32.png`
  — permiten que, al abrir el link, se pueda "Añadir a pantalla de inicio" y
  quede con ícono propio, como una app, sin pasar por ninguna tienda.
- `generate_icons.py` — el script que generó los íconos, por si en algún
  momento quieres cambiar el color o el diseño del ícono tú mismo.

## Publicarlo gratis (Vercel + GitHub)

1. Crea un repositorio nuevo en GitHub (ej. `countdown-princesa`) y sube
   todos estos archivos (menos `generate_icons.py`, ese es opcional).
2. Entra a [vercel.com](https://vercel.com), inicia sesión con tu cuenta de
   GitHub, y elige **Add New → Project**.
3. Importa el repositorio. No necesita build command ni framework — elige
   **Other** como preset y dale **Deploy**.
4. Vercel te da un link del tipo `countdown-princesa.vercel.app`. Ese es el
   que le compartes.

## Que ella lo tenga como si fuera una app

Cuando le pases el link:

- **iPhone (Safari):** abre el link → botón de compartir → *"Añadir a
  pantalla de inicio"*.
- **Android (Chrome):** abre el link → menú ⋮ → *"Añadir a pantalla de
  inicio"* / *"Instalar app"*.

Le queda un ícono propio (el reloj dorado) en su pantalla de inicio. Cada vez
que lo abra, la cuenta regresiva ya está actualizada — no necesita hacer
nada.

## Editar los mensajes

Todos los textos según cuánto falte están juntos al principio de
`script.js`, en el arreglo `MESSAGES` — cada línea es un tramo de días
("faltan 90+", "faltan 30+", etc.) con su propio texto. Cámbialos ahí
directamente, o pídemelo cuando quieras.

El mensaje del día en que se cumple la fecha (`DONE_MESSAGE`, justo debajo)
también se edita ahí.

## Reutilizarlo para la próxima vez

Cuando el 31 de diciembre pase, la página no se rompe: se queda en pantalla
mostrando `DONE_MESSAGE`. Para la siguiente cuenta regresiva (el próximo
reencuentro), solo cambia la fecha en la constante `TARGET`, arriba de
`script.js`, y vuelve a publicar — es la misma página, lista para la
próxima vez. Ojo con un detalle: de finales de marzo a finales de octubre
Madrid está en horario de verano (`+02:00`, no `+01:00`) — si la próxima
fecha cae en esos meses, avísame o ajusta el offset.

## Mensajes en vivo (Firebase — gratis, sin tarjeta)

Esto conecta tu panel privado (`admin.html`) con su página. Se hace una
sola vez, dura unos 10 minutos.

**1. Crear el proyecto**
En [console.firebase.google.com](https://console.firebase.google.com),
**Crear un proyecto** (el plan gratuito "Spark" no pide tarjeta — es
suficiente para esto para siempre; con la cantidad de mensajes que vas a
mandar no hay forma de acercarse al límite gratuito).

**2. Activar la base de datos**
Menú lateral → **Firestore Database** → **Crear base de datos** → modo
producción → elige una región cercana a Madrid (por ejemplo `eur3
(europe-west)`).

**3. Activar el login**
Menú lateral → **Authentication** → **Sign-in method** → habilita
**Correo electrónico/contraseña**. Luego pestaña **Users** → **Add user**
→ pon tu correo y una contraseña que solo tú conozcas. Esa es la cuenta
con la que entras a tu panel — no hay registro público, así que nadie más
puede crear una cuenta ahí.

**4. Reglas de acceso**
Firestore Database → pestaña **Rules** → reemplaza todo por esto y
publica:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /love/latest {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Esto dice: cualquiera puede *leer* el mensaje (así funciona su página, sin
que ella necesite cuenta ni login), pero solo alguien con sesión iniciada
—o sea, tú— puede *escribirlo*.

**5. Conectar el sitio**
⚙️ (junto a "Project Overview") → **Project settings** → baja hasta
**Tus apps** → ícono `</>` (Web) → regístrala con cualquier nombre → copia
el objeto `firebaseConfig` que te muestra. Pégalo en `firebase-config.js`,
reemplazando los valores de plantilla (`TU_API_KEY`, etc.). Estos datos no
son secretos — es normal que queden visibles en el código, incluso en
GitHub; lo que protege el mensaje son las reglas del paso 4, no ocultar
esto.

**6. Publicar**
Sube todos los archivos (incluido `firebase-config.js` ya editado) a tu
repositorio de GitHub. Vercel vuelve a publicar solo.

**7. Usarlo**
Abre `tudominio.vercel.app/admin.html` en tu celular, entra con el correo
y la contraseña del paso 3, y guárdalo — es tu panel, no lo compartas con
ella. Escribe algo y dale **Enviar**. Si tienes su página abierta al mismo
tiempo, vas a ver el mensaje cambiar solo, sin refrescar.

**Sobre "que le aparezca sola":** en cuanto guardas, su página se
actualiza al instante *si la tiene abierta*. Si no la tiene abierta en ese
momento, no le suena el celular ni nada — simplemente ve el mensaje nuevo
la próxima vez que la abra (siempre está al día, ella nunca ve algo
viejo). Avisarle con una notificación real, aunque no tenga la página
abierta, es técnicamente posible (se llama web push) pero es una pieza
bastante más grande — si en algún momento la quieres, la construimos
aparte.
