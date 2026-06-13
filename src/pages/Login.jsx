import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 50%), var(--bg-dark)',
      padding: '1.5rem'
    }}>
      <div className="premium-card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '1px',
            background: 'linear-gradient(to right, #10b981, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            UMA MICRON
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          Default admin: <strong style={{ color: 'var(--text-main)' }}>admin</strong> / <strong style={{ color: 'var(--text-main)' }}>admin123</strong>
        </p>
      </div>
    </div>
  );
};

export default Login;
