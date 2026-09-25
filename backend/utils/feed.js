// utils/feed.js
const db = require('../db');

function serializeBubble(row, currentUserId) {
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE bubble_id = ?').get(row.id).c;
  const repostCount = db
    .prepare('SELECT COUNT(*) AS c FROM reposts WHERE bubble_id = ?')
    .get(row.id).c;

  const likedByMe = currentUserId
    ? !!db.prepare('SELECT 1 FROM likes WHERE bubble_id = ? AND user_id = ?').get(row.id, currentUserId)
    : false;
  const repostedByMe = currentUserId
    ? !!db.prepare('SELECT 1 FROM reposts WHERE bubble_id = ? AND user_id = ?').get(row.id, currentUserId)
    : false;

  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      profilePhoto: row.profile_photo ? `/uploads/${row.profile_photo}` : null,
    },
    likeCount,
    likedByMe,
    repostCount,
    repostedByMe,
  };
}

// Combina filas de "bubbles originales" y "reposts" (ambas ya traen los JOIN con users)
// en una sola lista de items de feed, ordenada por fecha del evento (post o repost) desc.
function buildFeedItems(originalRows, repostRows, currentUserId) {
  const originalItems = originalRows.map((row) => ({
    type: 'original',
    eventTime: row.created_at,
    bubble: serializeBubble(row, currentUserId),
  }));

  const repostItems = repostRows.map((row) => ({
    type: 'repost',
    eventTime: row.repost_created_at,
    repostedBy: {
      id: row.reposter_id,
      username: row.reposter_username,
      displayName: row.reposter_display_name,
    },
    bubble: serializeBubble(row, currentUserId),
  }));

  return [...originalItems, ...repostItems].sort(
    (a, b) => new Date(b.eventTime + 'Z') - new Date(a.eventTime + 'Z')
  );
}

module.exports = { buildFeedItems, serializeBubble };
