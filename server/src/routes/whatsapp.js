import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getWhatsAppStatus,
  startWhatsApp,
  stopWhatsApp,
  sendWhatsAppText
} from '../services/whatsappService.js';

const router = Router();

router.use(requireAuth);

router.get('/status', (_req, res) => {
  res.json(getWhatsAppStatus());
});

router.post('/connect', async (_req, res) => {
  try {
    const status = await startWhatsApp();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to connect WhatsApp.' });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const logout = Boolean(req.body?.logout);
    const status = await stopWhatsApp({ logout });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to disconnect WhatsApp.' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { phone, text } = req.body || {};
    const result = await sendWhatsAppText(phone, text);
    res.json(result);
  } catch (err) {
    const msg = err.message || 'Failed to send WhatsApp message.';
    const code = /not connected/i.test(msg) ? 409 : 400;
    res.status(code).json({ error: msg });
  }
});

export default router;
