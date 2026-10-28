import React, { useCallback, useEffect, useState } from 'react';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Dashboard({ token, onSignOut }) {
  const [file, setFile] = useState(null);
  const [expiryMinutes, setExpiryMinutes] = useState('1440');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/media`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.status === 401) { onSignOut(); return; }
      if (!response.ok) throw new Error(data.message);
      setItems(data.media || []);
    } catch (e) { setError(e.message || 'Could not load media list.'); }
  }, [token, onSignOut]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 5000); return () => clearInterval(timer); }, [refresh]);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!file) return setError('Choose an image or video first.');
    const form = new FormData(); form.append('file', file); form.append('expiryMinutes', expiryMinutes);
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (response.status === 401) { onSignOut(); return; }
      if (!response.ok) throw new Error(data.message || 'Upload failed.');
      setMessage(`Upload complete. Share link: ${data.media.shareUrl}`); setFile(null); event.target.reset(); await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function revoke(id) {
    if (!window.confirm('Revoke this link and delete its file from the server?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.status === 401) { onSignOut(); return; }
      if (!response.ok) throw new Error(data.message);
      setMessage(data.message); await refresh();
    } catch (e) { setError(e.message || 'Revoke failed.'); }
  }

  return <section className="dashboard">
    <div className="intro"><div><p className="eyebrow">PRIVATE BY LINK</p><h1>Share media, on your terms.</h1><p className="subhead">Upload an image or video. Choose when its link stops working.</p></div><div className="hero-icon">↗</div></div>
    <form className="upload-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>New upload</h2><p>Images and videos up to 10 MB</p></div><span className="step-label">01 / UPLOAD</span></div>
      <label className="file-drop"><input type="file" accept="image/*,video/*" onChange={e => setFile(e.target.files[0] || null)} /><span className="upload-symbol">＋</span><strong>{file ? file.name : 'Choose a file to share'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'or drop it here · image or video'}</span></label>
      <div className="form-bottom"><label className="expiry-label">LINK EXPIRES<select value={expiryMinutes} onChange={e => setExpiryMinutes(e.target.value)}><option value="60">In 1 hour</option><option value="1440">In 1 day</option><option value="10080">In 7 days</option><option value="43200">In 30 days</option></select></label><button className="primary-button" disabled={busy}>{busy ? 'Uploading…' : 'Upload and create link'} <span>→</span></button></div>
      {message && <div className="notice success">{message.includes('http') ? <>Upload complete. Share link: <a href={message.split('Share link: ')[1]}>{message.split('Share link: ')[1]}</a></> : message}</div>}{error && <div className="notice error">{error}</div>}
    </form>
    <section className="library"><div className="section-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Shared media</h2></div><span className="count-pill">{items.length} {items.length === 1 ? 'FILE' : 'FILES'}</span></div>
      {items.length === 0 ? <div className="empty-state"><span>▧</span><strong>No uploads yet</strong><p>Your shared files will appear here.</p></div> : <div className="media-list">{items.map(item => <article className="media-card" key={item.id}><div className="file-icon">{item.mimeType.startsWith('video/') ? '▶' : '▧'}</div><div className="file-info"><strong title={item.originalName}>{item.originalName}</strong><span>{(item.fileSize / 1024 / 1024).toFixed(2)} MB · Expires {new Date(item.expiresAt).toLocaleString()}</span></div><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span><span className="views"><strong>{item.viewCount}</strong> views</span><a className="small-link" href={item.shareUrl} target="_blank" rel="noreferrer">Open ↗</a>{!item.isRevoked && item.status !== 'Expired' && <button className="revoke-button" onClick={() => revoke(item.id)}>Revoke</button>}</article>)}</div>}
    </section>
    <p className="notice warning">Your library and revoke controls are limited to your account. Anyone with a valid share link can view its media until it expires or you revoke it.</p>
  </section>;
}
