import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  buildFullState,
  persistClientState,
  appendAuditLogs,
  fetchAuditLogs
} from '../services/stateService.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'uma-api' });
});

router.get('/', requireAuth, async (_req, res) => {
  try {
    const state = await buildFullState();
    res.json(state);
  } catch (err) {
    console.error('Fetch state error:', err);
    res.status(500).json({ error: 'Failed to load application data.' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    await persistClientState(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save state error:', err);
    res.status(500).json({ error: 'Failed to save application data.' });
  }
});

router.post('/import', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can import data.' });
    }
    await persistClientState(req.body);
    const state = await buildFullState();
    res.json(state);
  } catch (err) {
    console.error('Import state error:', err);
    res.status(500).json({ error: 'Failed to import data.' });
  }
});

router.get('/audit-logs', requireAuth, async (req, res) => {
  try {
    const logs = await fetchAuditLogs(parseInt(req.query.limit || '500', 10));
    res.json(logs);
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

router.post('/audit-logs', requireAuth, async (req, res) => {
  try {
    const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];
    await appendAuditLogs(logs);
    res.json({ ok: true, count: logs.length });
  } catch (err) {
    console.error('Append audit logs error:', err);
    res.status(500).json({ error: 'Failed to save audit logs.' });
  }
});

export default router;
