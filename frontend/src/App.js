import React, { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import MediaView from './components/MediaView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [auth, setAuth] = useState({ token: sessionStorage.getItem('mediaSession'), user: null, checking: true });
  useEffect(() => {
    const token = sessionStorage.getItem('mediaSession');
    if (!token) { setAuth({ token: null, user: null, checking: false }); return; }
    fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); return data.user; })
      .then(user => setAuth({ token, user, checking: false }))
      .catch(() => { sessionStorage.removeItem('mediaSession'); setAuth({ token: null, user: null, checking: false }); });
  }, []);

  function signedIn(token, user) { sessionStorage.setItem('mediaSession', token); setAuth({ token, user, checking: false }); }
  const signOut = useCallback(async () => {
    if (auth.token) await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` } }).catch(() => {});
    sessionStorage.removeItem('mediaSession'); setAuth({ token: null, user: null, checking: false });
  }, [auth.token]);

  return <div className="app-shell"><header className="topbar"><Link to="/" className="brand"><span className="brand-mark">M</span> Local Media Share</Link><div className="topbar-right">{auth.user && <><span className="account-email">{auth.user.email}</span><button className="signout-button" onClick={signOut}>Sign out</button></>}<span className="local-badge">LOCAL STORAGE</span></div></header><main><Routes><Route path="/share/:token" element={<MediaView />} /><Route path="/login" element={auth.checking ? <div className="loading">Checking your session…</div> : <LoginScreen onAuthenticated={signedIn} />} /><Route path="/" element={auth.checking ? <div className="loading">Checking your session…</div> : auth.user ? <Dashboard token={auth.token} onSignOut={signOut} /> : <LoginScreen onAuthenticated={signedIn} />} /><Route path="*" element={auth.checking ? <div className="loading">Checking your session…</div> : auth.user ? <Dashboard token={auth.token} onSignOut={signOut} /> : <LoginScreen onAuthenticated={signedIn} />} /></Routes></main><footer>Files are stored on this server and served until their link expires or is revoked.</footer></div>;
}
