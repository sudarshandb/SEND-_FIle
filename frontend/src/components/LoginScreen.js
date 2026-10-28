import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function LoginScreen({ onAuthenticated }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not sign in.');
      onAuthenticated(data.token, data.user);
      navigate('/', { replace: true });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <section className="auth-wrap"><div className="auth-card"><p className="eyebrow">OWNER ACCOUNT</p><h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1><p className="auth-subtitle">Your uploads and share controls belong to your account.</p><form onSubmit={submit}>
    <label className="auth-field">EMAIL<input autoComplete="email" type="email" required maxLength="254" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
    <label className="auth-field">PASSWORD<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" required minLength="8" maxLength="128" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
    {error && <div className="notice error">{error}</div>}
    <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
  </form><p className="auth-switch">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><p className="auth-note">Passwords are stored as scrypt hashes. Keep your account credentials private.</p></div></section>;
}
