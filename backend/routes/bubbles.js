// routes/bubbles.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { buildFeedItems, serializeBubble } = require('../utils/feed');

const router = express.Router();

// GET /api/bubbles -> timeline público: bubbles originales + reposts, mezclados por fecha
router.get('/', optionalAuth, (req, res) => {
  const originals = db
    .prepare(
      `SELECT bubbles.*, users.username, users.display_name, users.profile_photo
       FROM bubbles JOIN users ON users.id = bubbles.user_id
       ORDER BY bubbles.created_at DESC LIMIT 100`
    )
    .all();

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
       ORDER BY reposts.created_at DESC LIMIT 100`
    )
    .all();

  const feed = buildFeedItems(originals, reposts, req.userId).slice(0, 100);
  res.json({ feed });
});

// POST /api/bubbles -> crear un nuevo bubble (requiere login) + notificar a quien lo pidió
router.post(
  '/',
  requireAuth,
  [
    body('content')
      .trim()
      .isLength({ min: 1, max: 280 })
      .withMessage('El contenido debe tener entre 1 y 280 caracteres.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { content } = req.body;
    const info = db
      .prepare('INSERT INTO bubbles (user_id, content) VALUES (?, ?)')
      .run(req.userId, content);
    const bubbleId = info.lastInsertRowid;

    // Notificaciones: solo a seguidores que ELIGIERON activarlas para este autor (opt-in).
    const followersToNotify = db
      .prepare('SELECT follower_id FROM follows WHERE followed_id = ? AND notify = 1')
      .all(req.userId);

    const insertNotif = db.prepare(
      'INSERT INTO notifications (recipient_id, actor_id, type, bubble_id) VALUES (?, ?, ?, ?)'
    );
    for (const f of followersToNotify) {
      insertNotif.run(f.follower_id, req.userId, 'post', bubbleId);
    }

    const row = db
      .prepare(
        `SELECT bubbles.*, users.username, users.display_name, users.profile_photo
         FROM bubbles JOIN users ON users.id = bubbles.user_id
         WHERE bubbles.id = ?`
      )
      .get(bubbleId);

    res.status(201).json({ bubble: serializeBubble(row, req.userId) });
  }
);

// DELETE /api/bubbles/:id -> solo el autor puede borrar su bubble
router.delete('/:id', requireAuth, (req, res) => {
  const bubble = db.prepare('SELECT * FROM bubbles WHERE id = ?').get(req.params.id);
  if (!bubble) return res.status(404).json({ error: 'No encontrado.' });
  if (bubble.user_id !== req.userId) {
    return res.status(403).json({ error: 'No tenés permiso para borrar esto.' });
  }
  db.prepare('DELETE FROM bubbles WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// POST /api/bubbles/:id/like -> togglear like
router.post('/:id/like', requireAuth, (req, res) => {
  const bubbleId = req.params.id;
  const bubble = db.prepare('SELECT id FROM bubbles WHERE id = ?').get(bubbleId);
  if (!bubble) return res.status(404).json({ error: 'No encontrado.' });

  const existing = db
    .prepare('SELECT id FROM likes WHERE bubble_id = ? AND user_id = ?')
    .get(bubbleId, req.userId);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO likes (bubble_id, user_id) VALUES (?, ?)').run(bubbleId, req.userId);
  }

  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE bubble_id = ?').get(bubbleId).c;
  res.json({ likeCount, likedByMe: !existing });
});

// POST /api/bubbles/:id/repost -> togglear repost (aparece en el perfil de quien repostea)
router.post('/:id/repost', requireAuth, (req, res) => {
  const bubbleId = req.params.id;
  const bubble = db.prepare('SELECT * FROM bubbles WHERE id = ?').get(bubbleId);
  if (!bubble) return res.status(404).json({ error: 'No encontrado.' });
  if (bubble.user_id === req.userId) {
    return res.status(400).json({ error: 'No podés repostear tu propio bubble.' });
  }

  const existing = db
    .prepare('SELECT id FROM reposts WHERE bubble_id = ? AND user_id = ?')
    .get(bubbleId, req.userId);

  if (existing) {
    db.prepare('DELETE FROM reposts WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO reposts (bubble_id, user_id) VALUES (?, ?)').run(bubbleId, req.userId);
  }

  const repostCount = db
    .prepare('SELECT COUNT(*) AS c FROM reposts WHERE bubble_id = ?')
    .get(bubbleId).c;
  res.json({ repostCount, repostedByMe: !existing });
});

module.exports = router;
