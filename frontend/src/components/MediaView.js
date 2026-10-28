import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function MediaView() {
  const { token } = useParams();
  const [media, setMedia] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/share/${encodeURIComponent(token)}`).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); return data.media; })
      .then(data => { if (active) setMedia(data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token]);
  if (failed) return <section className="expired-page"><div className="expired-icon">⌁</div><p className="eyebrow">UNAVAILABLE</p><h1>Link Expired</h1><p>This media link has expired or was revoked by its owner.</p><Link to="/" className="back-link">Go to home →</Link></section>;
  if (!media) return <div className="loading">Opening shared media…</div>;
  return <section className="viewer"><div className="viewer-heading"><div><p className="eyebrow">SHARED MEDIA</p><h1>{media.originalName}</h1></div><Link to="/" className="back-link">← Home</Link></div><div className="asset-frame">{media.mimeType.startsWith('video/') ? <video src={media.assetUrl} controls playsInline /> : <img src={media.assetUrl} alt={media.originalName} />}</div><div className="viewer-meta"><span>{(media.fileSize / 1024 / 1024).toFixed(2)} MB</span><span>·</span><span>{media.viewCount} views</span><span>·</span><span>Expires {new Date(media.expiresAt).toLocaleString()}</span></div></section>;
}
