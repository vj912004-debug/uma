import { Router } from 'express';
import { verifyPassword, seedPasswordHashForUsername } from '../utils/hash.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import {
  findUserByUsername,
  findUserById,
  buildFullState,
  ensureDefaultUsers,
  repairSeedUserPassword
} from '../services/stateService.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // First boot / empty DB: seed demo admin & staff so published credentials work.
    await ensureDefaultUsers();

    let user = await findUserByUsername(username);
    const seedHash = seedPasswordHashForUsername(username);

    // Inactive seed accounts can be revived with the published demo password.
    if (user && user.active === false && seedHash && verifyPassword(password, seedHash)) {
      await repairSeedUserPassword(user.id, seedHash);
      user = { ...user, active: true, passwordHash: seedHash };
    }

    if (!user || user.active === false) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    let passwordHash = user.passwordHash;
    if (seedHash) {
      // Keep published demo credentials working even if DB hash drifted.
      if (verifyPassword(password, seedHash)) {
        if (passwordHash !== seedHash) {
          await repairSeedUserPassword(user.id, seedHash);
          passwordHash = seedHash;
        }
      } else if (!passwordHash || passwordHash.startsWith('000000000000') || !verifyPassword(password, passwordHash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
    } else {
      if (!passwordHash || passwordHash.startsWith('000000000000')) {
        return res.status(401).json({ error: 'No login credentials set. Contact your administrator.' });
      }
      if (!verifyPassword(password, passwordHash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
    }

    const authedUser = { ...user, passwordHash, active: true };
    const token = signToken(authedUser);
    const state = await buildFullState();
    const { passwordHash: _omit, ...safeUser } = authedUser;

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
