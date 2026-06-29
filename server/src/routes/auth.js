import { Router } from 'express';
import { verifyPassword } from '../utils/hash.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { findUserByUsername, findUserById, buildFullState } from '../services/stateService.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await findUserByUsername(username);
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!user.passwordHash || user.passwordHash.startsWith('000000000000')) {
      return res.status(401).json({ error: 'No login credentials set. Contact your administrator.' });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = signToken(user);
    const state = await buildFullState();
    const { passwordHash, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
      state
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'User not found.' });
    }
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

export default router;
