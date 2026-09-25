// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { encrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    profilePhoto: row.profile_photo ? `/uploads/${row.profile_photo}` : null,
    createdAt: row.created_at,
  };
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('El usuario debe tener 3-20 caracteres (letras, números, _).'),
    body('email').isEmail().normalizeEmail().withMessage('Email inválido.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres.'),
    body('displayName').trim().isLength({ min: 1, max: 50 }).withMessage('Nombre inválido.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, displayName } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const emailEncrypted = encrypt(email);

    const info = db
      .prepare(
        'INSERT INTO users (username, email_encrypted, password_hash, display_name) VALUES (?, ?, ?, ?)'
      )
      .run(username, emailEncrypted, passwordHash, displayName);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user.id);

    res.status(201).json({ token, user: publicUser(user) });
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Falta el usuario.'),
    body('password').notEmpty().withMessage('Falta la contraseña.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    // Respuesta genérica para no revelar si el usuario existe o no
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
