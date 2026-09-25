# BigBubble 🫧

Un clon básico de Twitter con backend seguro y frontend simple.

## Qué incluye

**Backend** (`/backend`) — Node.js + Express + SQLite
- Contraseñas hasheadas con **bcrypt** (nunca se guardan en texto plano)
- Email **obligatorio** y cifrado en la base de datos con **AES-256-GCM** (nunca se expone en ninguna respuesta de la API)
- Autenticación con **JWT** (tokens firmados, con expiración)
- **Helmet** (cabeceras HTTP seguras) y **CORS** restringido a tu dominio
- **Rate limiting** general y reforzado en login/registro (anti fuerza bruta)
- Validación de todos los inputs (`express-validator`)
- Consultas parametrizadas (protección contra inyección SQL)
- Cada usuario solo puede borrar sus propios bubbles (autorización a nivel de recurso)
- Fotos de perfil re-codificadas con **sharp**, eliminando automáticamente todos los metadatos EXIF (incluida ubicación GPS). Acepta JPG, PNG, WEBP y **GIF animado** (la animación se conserva)
- Sin logging de requests / IPs (no hay morgan ni ninguna librería de logging de tráfico)
- Borrado de cuenta real: elimina el usuario y, en cascada, todos sus bubbles, likes, reposts, follows, notificaciones y foto de perfil

**Frontend** (`/frontend`) — HTML + CSS + JS plano, sin frameworks
- Login / registro (email obligatorio)
- Publicar "bubbles" (280 caracteres)
- **Reposts**: repostear el contenido de otra persona, aparece en tu perfil marcado como repost
- **Foto de perfil**: subida con recorte automático, limpieza de metadatos, soporta GIF animado
- **Búsqueda de usuarios** por nombre de usuario o nombre para mostrar
- **Notificaciones opt-in**: por cada persona que seguís, vos elegís si querés que te avisen cuando publique (desactivado por defecto)
- **Modo nocturno**: botón en la barra superior para alternar entre tema claro y oscuro, con preferencia guardada en el navegador (respeta el modo del sistema operativo la primera vez, y después el usuario lo puede cambiar manualmente en cualquier momento)
- **Íconos SVG propios** (no emojis) para corazón, repost, campana, cámara, sol/luna, cerrar sesión, buscar y borrar: se ven exactamente igual en Windows, Mac, Linux, iOS y Android, sin depender de qué fuente de emojis tenga instalada cada dispositivo
- **Diseño responsive**: la barra de búsqueda, los avatares, los botones y el layout general se adaptan a pantallas de celular
- Perfil de usuario con sus bubbles + reposts, editar nombre/bio, borrar cuenta
- Timeline, likes, borrar tus propios bubbles

> Nota sobre "encriptado": las contraseñas se **hashean** (bcrypt), que es la práctica correcta y de una sola vía — nunca se "desencriptan". El email se cifra de forma reversible con AES-256-GCM y nunca se devuelve en ninguna respuesta de la API. Para cifrado completo del archivo de base de datos en disco, ver la sección de opciones avanzadas más abajo.

## Privacidad y anonimato — decisiones de diseño

- **Las fotos de perfil se limpian automáticamente**, incluidas las GIF. El servidor nunca guarda el archivo que subís tal cual: lo re-codifica con `sharp`, lo que elimina cualquier metadato EXIF, incluida la ubicación GPS que muchos celulares embeben en las fotos sin que el usuario se dé cuenta.
- **El email nunca se expone**, ni siquiera al propio dueño de la cuenta vía API: se guarda cifrado y solo se usaría, a futuro, para recuperación de cuenta.
- **Sin tracking ni logging de tráfico.** El backend no incluye ninguna librería de logging de requests (nada de Google Analytics, Sentry, morgan, etc. por defecto).
- **Notificaciones 100% opt-in**, persona por persona: seguir a alguien no activa notificaciones automáticamente, el usuario decide explícitamente de quién quiere recibir avisos.
- **Borrado de cuenta real e irreversible**, que elimina en cascada todo el contenido asociado (bubbles, likes, reposts, follows, notificaciones, foto).
- **Username pseudónimo**: no se requiere nombre real en ningún campo; "nombre para mostrar" puede ser cualquier cosa.

### Qué podrías sumar para llevar el anonimato más lejos (no incluido acá, por alcance)
- **Cuentas privadas** (aprobar seguidores antes de que vean tus bubbles) — hoy todos los bubbles son públicos, como en Twitter.
- **2FA sin teléfono** (con apps tipo TOTP/Authenticator) en vez de depender de email para recuperación de cuenta.
- **Proxy de imágenes** para que ni siquiera tu backend vea la IP de quien mira una foto (poco común, pero posible con un CDN intermedio).
- Si migrás a Postgres en un proveedor cloud, revisá su política de logs de acceso — algunos guardan IPs por defecto en sus balanceadores.

---

## 1. Correrlo en tu computadora (desarrollo local)

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Editá `.env` y poné un secreto real en `JWT_SECRET`. Podés generar uno con:

```bash
openssl rand -hex 64
```

Después arrancá el servidor:

```bash
npm start
```

Vas a ver: `[BigBubble] Backend corriendo en el puerto 4000`

### Frontend

El frontend es estático, no necesita build. La forma más simple:

```bash
cd frontend
python3 -m http.server 5173
```

Abrí `http://localhost:5173` en el navegador. Ya está apuntando a `http://localhost:4000/api` por defecto.

---

## 2. Deploy a producción

La forma más simple y barata es: **backend en Render (o Railway/Fly.io)** + **frontend en Vercel/Netlify/GitHub Pages**. Con dominio propio y HTTPS gratis en ambos casos.

### Paso 1 — Subir el código a GitHub

```bash
cd bigbubble
git init
git add .
git commit -m "BigBubble inicial"
```

Creá un repo en GitHub y hacé push. **Verificá que `.env` esté en `.gitignore`** (ya viene incluido) para no subir tus secretos.

### Paso 2 — Deploy del backend (ejemplo con Render.com)

1. Entrá a [render.com](https://render.com) y creá una cuenta.
2. "New" → "Web Service" → conectá tu repo de GitHub.
3. Configurá:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. En "Environment Variables" agregá las mismas variables de tu `.env`:
   - `JWT_SECRET` → generá una nueva con `openssl rand -hex 64` (no reutilices la de desarrollo)
   - `CORS_ORIGIN` → la URL de tu frontend en producción (ej: `https://bigbubble.vercel.app`)
   - `JWT_EXPIRES_IN` → `7d`
   - `BCRYPT_SALT_ROUNDS` → `12`
   - `DB_PATH` → `./data/bigbubble.db`
5. **Importante:** en el plan gratuito de Render el disco no es persistente entre deploys — esto afecta tanto la base de datos (`/backend/data`) como las fotos de perfil (`/backend/uploads`). Para producción real, agregá un "Persistent Disk" (Render lo ofrece pagando) montado en ambas carpetas, o migrá la base a PostgreSQL y las fotos a un bucket tipo S3/Cloudflare R2 (ver abajo).
6. Deploy. Render te da una URL tipo `https://bigbubble-backend.onrender.com`, ya con HTTPS automático.

### Paso 3 — Deploy del frontend (ejemplo con Vercel)

1. En `frontend/app.js`, la línea `API_URL` puede tomar la URL del backend desde una variable global. Antes de deployar, agregá justo antes de `</body>` en `index.html`:
   ```html
   <script>window.BIGBUBBLE_API_URL = "https://bigbubble-backend.onrender.com/api";</script>
   <script src="app.js"></script>
   ```
2. En [vercel.com](https://vercel.com), "Add New" → "Project" → importá el repo → seleccioná la carpeta `frontend` como root.
3. Como es HTML estático, no hace falta build command. Deploy.
4. Vercel te da una URL con HTTPS, ej: `https://bigbubble.vercel.app`.
5. Volvé a Render y actualizá `CORS_ORIGIN` con esa URL exacta.

### Paso 4 — Dominio propio (opcional)

Tanto Render como Vercel permiten conectar un dominio propio (ej: `bigbubble.com`) desde su panel, con certificado HTTPS automático vía Let's Encrypt.

---

## 3. Alternativa: deploy en tu propio VPS (Docker)

Si preferís tener control total (ej: un droplet de DigitalOcean, una VM de Hetzner, etc.):

```dockerfile
# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

```bash
docker build -t bigbubble-backend ./backend
docker run -d -p 4000:4000 --env-file backend/.env -v $(pwd)/data:/app/data bigbubble-backend
```

Para el frontend, cualquier servidor web estático sirve (Nginx, Caddy). Ejemplo con **Caddy** (te da HTTPS automático con Let's Encrypt sin configurar nada):

```
# Caddyfile
bigbubble.tudominio.com {
    reverse_proxy /api/* localhost:4000
    root * /var/www/bigbubble/frontend
    file_server
}
```

Esto sirve el frontend y hace de proxy inverso HTTPS hacia el backend, todo con un solo certificado.

---

## 4. Opciones avanzadas de seguridad para producción real

- **Cifrado de la base de datos en disco:** SQLite no cifra el archivo por defecto. Para eso podés:
  - Usar el disco cifrado del proveedor cloud (Render, AWS EBS, DigitalOcean ya ofrecen cifrado at-rest en sus discos administrados), o
  - Migrar a **PostgreSQL gestionado** (Render, Supabase, Neon) que ya viene con cifrado en reposo y backups automáticos — recomendado si esperás más de un puñado de usuarios.
- **Backups automáticos** de la base de datos (diarios como mínimo).
- **Monitoreo y logs** con algo como Sentry para errores del backend.
- **HTTPS obligatorio**: nunca sirvas la app sin TLS en producción (Render/Vercel/Caddy lo manejan automático).
- **Variables de entorno**: nunca subas `.env` a git; usá el gestor de secretos de tu proveedor (Render/Vercel tienen uno integrado).
- **Rotar JWT_SECRET** periódicamente invalida todos los tokens activos (los usuarios deberán volver a loguearse).

---

## Estructura del proyecto

```
bigbubble/
├── backend/
│   ├── server.js          # servidor Express + middlewares de seguridad
│   ├── db.js               # conexión y esquema SQLite
│   ├── utils/crypto.js     # cifrado AES-256-GCM para datos sensibles
│   ├── middleware/auth.js  # verificación de JWT
│   ├── routes/auth.js      # registro / login / me
│   ├── routes/bubbles.js   # crear/listar/borrar bubbles, likes, follows
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```
