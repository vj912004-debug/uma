import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '../../data/whatsapp-auth');

const logger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });

let sock = null;
let starting = false;
/** @type {'idle'|'connecting'|'qr'|'connected'|'logged_out'} */
let status = 'idle';
let qrDataUrl = null;
let lastError = null;
let connectedPhone = null;

const ensureAuthDir = () => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
};

const clearAuthDir = () => {
  if (!fs.existsSync(AUTH_DIR)) return;
  for (const name of fs.readdirSync(AUTH_DIR)) {
    fs.rmSync(path.join(AUTH_DIR, name), { recursive: true, force: true });
  }
};

export const getWhatsAppStatus = () => ({
  status,
  qrDataUrl: status === 'qr' ? qrDataUrl : null,
  connectedPhone,
  lastError,
  ready: status === 'connected' && !!sock
});

const toJid = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('Phone number is required.');
  if (digits.length === 10) digits = `91${digits}`;
  return `${digits}@s.whatsapp.net`;
};

export async function startWhatsApp() {
  if (status === 'connected' && sock) {
    return getWhatsAppStatus();
  }
  if (starting) {
    return getWhatsAppStatus();
  }

  starting = true;
  lastError = null;
  status = 'connecting';
  qrDataUrl = null;

  try {
    ensureAuthDir();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const socket = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      printQRInTerminal: false
    });

    sock = socket;

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320
          });
          status = 'qr';
          lastError = null;
        } catch (err) {
          lastError = err.message || 'Failed to build QR code.';
        }
      }

      if (connection === 'open') {
        status = 'connected';
        qrDataUrl = null;
        lastError = null;
        const id = socket.user?.id || '';
        connectedPhone = id.split(':')[0].split('@')[0] || null;
        starting = false;
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        sock = null;
        connectedPhone = null;
        qrDataUrl = null;
        starting = false;

        if (loggedOut) {
          status = 'logged_out';
          lastError = 'WhatsApp session logged out. Scan QR again.';
          clearAuthDir();
        } else {
          status = 'idle';
          lastError = lastDisconnect?.error?.message || 'Connection closed.';
          // Auto-reconnect unless intentional logout
          setTimeout(() => {
            if (status === 'idle') startWhatsApp().catch(() => {});
          }, 2500);
        }
      }
    });

    return getWhatsAppStatus();
  } catch (err) {
    starting = false;
    status = 'idle';
    lastError = err.message || 'Failed to start WhatsApp.';
    sock = null;
    throw err;
  }
}

export async function stopWhatsApp({ logout = false } = {}) {
  starting = false;
  try {
    if (logout && sock) {
      await sock.logout().catch(() => {});
      clearAuthDir();
    } else if (sock) {
      sock.end(undefined);
    }
  } finally {
    sock = null;
    qrDataUrl = null;
    connectedPhone = null;
    status = logout ? 'logged_out' : 'idle';
  }
  return getWhatsAppStatus();
}

export async function sendWhatsAppText(phone, text) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp is not connected. Scan the QR code first.');
  }
  const message = String(text || '').trim();
  if (!message) throw new Error('Message text is required.');

  const jid = toJid(phone);
  const result = await sock.sendMessage(jid, { text: message });
  return {
    ok: true,
    messageId: result?.key?.id || null,
    to: jid
  };
}
