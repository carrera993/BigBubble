// routes/notifications.js
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications -> últimas notificaciones del usuario logueado
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT notifications.*, actor.username AS actor_username,
              actor.display_name AS actor_display_name, actor.profile_photo AS actor_photo,
              bubbles.content AS bubble_content
       FROM notifications
       JOIN users AS actor ON actor.id = notifications.actor_id
       LEFT JOIN bubbles ON bubbles.id = notifications.bubble_id
       WHERE notifications.recipient_id = ?
       ORDER BY notifications.created_at DESC
       LIMIT 50`
    )
    .all(req.userId);

  const unreadCount = db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0')
    .get(req.userId).c;

  res.json({
    unreadCount,
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      isRead: !!n.is_read,
      createdAt: n.created_at,
      bubbleId: n.bubble_id,
      bubbleContent: n.bubble_content,
      actor: {
        id: n.actor_id,
        username: n.actor_username,
        displayName: n.actor_display_name,
        profilePhoto: n.actor_photo ? `/uploads/${n.actor_photo}` : null,
      },
    })),
  });
});

// POST /api/notifications/read-all -> marcar todas como leídas
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(req.userId);
  res.status(204).send();
});

module.exports = router;
