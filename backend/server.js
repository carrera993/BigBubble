// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const path = require('path');

const authRoutes = require('./routes/auth');
const bubbleRoutes = require('./routes/bubbles');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('cambiar_por')) {
  console.error(
    '\n[BigBubble] ERROR: Configurá JWT_SECRET en tu archivo .env con un valor secreto real antes de arrancar en producción.\n'
  );
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

const app = express();

// Si el backend corre detrás de un proxy (Render, Nginx, Caddy), esto permite que
// express-rate-limit identifique correctamente al cliente. No implica loguear IPs:
// esta app no tiene ningún middleware de logging de requests (sin morgan ni similares),
// por diseño, para minimizar el rastro de los usuarios.
app.set('trust proxy', 1);

// Seguridad de cabeceras HTTP
app.use(
  helmet({
    // Permite que el frontend (en otro origen) cargue las fotos de perfil servidas desde /uploads
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS restringido al origen del frontend
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));

// Rate limiting general (protege contra abuso / fuerza bruta)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Rate limiting más estricto para login/registro (anti fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Fotos de perfil (sin metadatos EXIF: ver routes/users.js -> /me/photo)
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/bubbles', bubbleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Manejador de errores genérico (no filtra detalles internos)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[BigBubble] Backend corriendo en el puerto ${PORT}`);
});
