import React, { useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, Unplug } from 'lucide-react';
import {
  checkApiHealth,
  getAuthToken,
  whatsappConnect,
  whatsappDisconnect,
  whatsappStatus
} from '../api/client';

/**
 * In-app WhatsApp Web link: shows QR until phone is scanned; stays connected on server.
 */
const WhatsAppConnectModal = ({ open, onClose, onConnected }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const healthy = await checkApiHealth();
      if (!healthy) {
        setError('Backend API is offline. Start the server (server/ → npm run dev), then try again.');
        setStatus(null);
        return;
      }
      if (!getAuthToken()) {
        setError('Log in while the backend API is online so WhatsApp can authenticate.');
      }
      const s = await whatsappStatus();
      setStatus(s);
      if (s?.ready || s?.status === 'connected') {
        setError('');
        onConnected?.(s);
      }
    } catch (err) {
      setError(err.message || 'Could not load WhatsApp status.');
    }
  };

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const healthy = await checkApiHealth();
      if (!healthy) {
        throw new Error('Backend API is offline. Start server with npm run dev inside /server.');
      }
      const s = await whatsappConnect();
      setStatus(s);
    } catch (err) {
      setError(err.message || 'Failed to start WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (logout) => {
    setBusy(true);
    setError('');
    try {
      const s = await whatsappDisconnect(logout);
      setStatus(s);
    } catch (err) {
      setError(err.message || 'Failed to disconnect.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    connect();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const connected = status?.status === 'connected' || status?.ready;
  const showQr = status?.status === 'qr' && status?.qrDataUrl;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
      <div className="premium-card" style={{ width: 420, maxWidth: '96%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} color="#25D366" /> Link WhatsApp
          </h2>
          <button type="button" className="btn" style={{ padding: '0.25rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
          Scan this QR with WhatsApp on your phone: <strong>Linked Devices → Link a Device</strong>.
          After linking, messages send from Uma without opening another page.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '0.65rem 0.8rem', borderRadius: 8, marginBottom: '0.85rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid var(--border-color, #e5e7eb)',
          marginBottom: '1rem'
        }}>
          {connected ? (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>Connected</div>
              {status?.connectedPhone && (
                <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  +{status.connectedPhone}
                </div>
              )}
            </div>
          ) : showQr ? (
            <img src={status.qrDataUrl} alt="WhatsApp QR" width={280} height={280} style={{ display: 'block' }} />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
              {busy || status?.status === 'connecting' ? 'Preparing QR…' : 'Waiting for WhatsApp…'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={busy} onClick={connect} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh QR
          </button>
          {connected && (
            <button type="button" className="btn" disabled={busy} onClick={() => disconnect(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Unplug size={14} /> Unlink
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ marginLeft: 'auto' }}>
            {connected ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnectModal;
