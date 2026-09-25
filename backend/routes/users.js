// routes/users.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { buildFeedItems } = require('../utils/feed');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Guardamos el archivo en memoria; lo procesamos con sharp antes de escribirlo a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato no soportado. Usá JPG, PNG, GIF o WEBP.'));
    }
    cb(null, true);
  },
});

function publicUser(row, extra = {}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    profilePhoto: row.profile_photo ? `/uploads/${row.profile_photo}` : null,
    createdAt: row.created_at,
    ...extra,
  };
}

// GET /api/users/search?q=texto
router.get('/search', optionalAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ users: [] });

  // Búsqueda por username o nombre para mostrar. Nunca se expone el email.
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE username LIKE ? OR display_name LIKE ?
       ORDER BY username ASC
       LIMIT 20`
    )
    .all(`%${q}%`, `%${q}%`);

  res.json({ users: rows.map((r) => publicUser(r)) });
});

// GET /api/users/:username -> perfil público + sus bubbles/reposts
router.get('/:username', optionalAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const followerCount = db
    .prepare('SELECT COUNT(*) AS c FROM follows WHERE followed_id = ?')
    .get(user.id).c;
  const followingCount = db
    .prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?')
    .get(user.id).c;

  let isFollowing = false;
  let notify = false;
  if (req.userId) {
    const f = db
      .prepare('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?')
      .get(req.userId, user.id);
    isFollowing = !!f;
    notify = !!(f && f.notify);
  }

  const originals = db
    .prepare(
      `SELECT bubbles.*, users.username, users.display_name, users.profile_photo
       FROM bubbles JOIN users ON users.id = bubbles.user_id
       WHERE bubbles.user_id = ?
       ORDER BY bubbles.created_at DESC LIMIT 100`
    )
    .all(user.id);

  const reposts = db
    .prepare(
      `SELECT reposts.id AS repost_id, reposts.created_at AS repost_created_at,
              reposts.user_id AS reposter_id,
              rp_user.username AS reposter_username, rp_user.display_name AS reposter_display_name,
              bubbles.*, orig_user.username, orig_user.display_name, orig_user.profile_photo
       FROM reposts
       JOIN bubbles ON bubbles.id = reposts.bubble_id
       JOIN users AS orig_user ON orig_user.id = bubbles.user_id
       JOIN users AS rp_user ON rp_user.id = reposts.user_id
       WHERE reposts.user_id = ?
       ORDER BY reposts.created_at DESC LIMIT 100`
    )
    .all(user.id);

  const feed = buildFeedItems(originals, reposts, req.userId).slice(0, 100);

  res.json({
    user: publicUser(user, { followerCount, followingCount, isFollowing, notify }),
    feed,
  });
});

// POST /api/users/me/photo -> subir/actualizar foto de perfil
router.post('/me/photo', requireAuth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

  try {
    // sharp re-codifica la imagen desde cero: esto elimina automáticamente los metadatos
    // EXIF (incluida cualquier coordenada GPS embebida por la cámara/celular), protegiendo
    // el anonimato del usuario. No usamos .withMetadata(), así que no se conserva nada.
    const isGif = req.file.mimetype === 'image/gif';
    const filename = `${crypto.randomBytes(16).toString('hex')}.${isGif ? 'gif' : 'jpg'}`;
    const outPath = path.join(UPLOAD_DIR, filename);

    if (isGif) {
      // { animated: true } procesa todos los frames y conserva la animación al re-codificar.
      await sharp(req.file.buffer, { animated: true })
        .resize(400, 400, { fit: 'cover' })
        .gif()
        .toFile(outPath);
    } else {
      await sharp(req.file.buffer)
        .rotate() // aplica la orientación correcta y luego descarta el tag EXIF de orientación
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(outPath);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const oldPhoto = user.profile_photo;

    db.prepare('UPDATE users SET profile_photo = ? WHERE id = ?').run(filename, req.userId);

    if (oldPhoto) {
      const oldPath = path.join(UPLOAD_DIR, oldPhoto);
      fs.unlink(oldPath, () => {}); // borramos la anterior, sin bloquear la respuesta
    }

    res.json({ profilePhoto: `/uploads/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'No se pudo procesar la imagen.' });
  }
});

// DELETE /api/users/me/photo -> quitar foto de perfil
router.delete('/me/photo', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (user.profile_photo) {
    fs.unlink(path.join(UPLOAD_DIR, user.profile_photo), () => {});
    db.prepare('UPDATE users SET profile_photo = NULL WHERE id = ?').run(req.userId);
  }
  res.status(204).send();
});

// POST /api/users/follow/:userId -> togglear follow (con preferencia de notificación inicial)
router.post('/follow/:userId', requireAuth, (req, res) => {
  const followedId = parseInt(req.params.userId, 10);
  if (followedId === req.userId) {
    return res.status(400).json({ error: 'No podés seguirte a vos mismo.' });
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(followedId);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const existing = db
    .prepare('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?')
    .get(req.userId, followedId);

  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(req.userId, followedId);
    return res.json({ following: false, notify: false });
  }

  db.prepare('INSERT INTO follows (follower_id, followed_id, notify) VALUES (?, ?, 0)').run(
    req.userId,
    followedId
  );
  res.json({ following: true, notify: false });
});

// PATCH /api/users/follow/:userId/notify -> activar/desactivar notificaciones de esa persona
// Es 100% opcional y desactivado por defecto: el usuario decide de quién quiere avisos.
router.patch('/follow/:userId/notify', requireAuth, (req, res) => {
  const followedId = parseInt(req.params.userId, 10);
  const enable = !!req.body.notify;

  const existing = db
    .prepare('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?')
    .get(req.userId, followedId);

  if (!existing) {
    return res.status(400).json({ error: 'Primero tenés que seguir a este usuario.' });
  }

  db.prepare('UPDATE follows SET notify = ? WHERE follower_id = ? AND followed_id = ?').run(
    enable ? 1 : 0,
    req.userId,
    followedId
  );

  res.json({ notify: enable });
});

// PATCH /api/users/me -> editar perfil (nombre / bio)
router.patch('/me', requireAuth, (req, res) => {
  const displayName = (req.body.displayName || '').trim();
  const bio = (req.body.bio || '').trim();

  if (displayName && displayName.length > 50) {
    return res.status(400).json({ error: 'El nombre es demasiado largo.' });
  }
  if (bio.length > 160) {
    return res.status(400).json({ error: 'La bio es demasiado larga (máx 160).' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(
    displayName || user.display_name,
    bio,
    req.userId
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(updated) });
});

// DELETE /api/users/me -> borrar la cuenta y todo su rastro (derecho al anonimato / al olvido)
router.delete('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (user && user.profile_photo) {
    fs.unlink(path.join(UPLOAD_DIR, user.profile_photo), () => {});
  }
  // ON DELETE CASCADE en el esquema borra en cadena: bubbles, likes, reposts,
  // follows y notificaciones asociadas a este usuario.
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  res.status(204).send();
});

module.exports = router;
