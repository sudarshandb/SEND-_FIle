const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const Media = require('./models/Media');
const User = require('./models/User');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const scrypt = promisify(crypto.scrypt);
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '20kb' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(18).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^(image|video)\//i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image and video files are accepted'));
  }
});

const apiBase = () => (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const frontendBase = () => (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const expired = media => media.expiresAt.getTime() <= Date.now();
const metadata = media => ({
  id: media._id.toString(), originalName: media.originalName, filename: media.filename,
  fileSize: media.fileSize, mimeType: media.mimeType, viewCount: media.viewCount,
  expiresAt: media.expiresAt, isRevoked: media.isRevoked, createdAt: media.createdAt,
  status: media.isRevoked ? 'Revoked' : (expired(media) ? 'Expired' : 'Active'),
  shareUrl: `${frontendBase()}/share/${media.shareToken}`,
  assetUrl: `${apiBase()}/api/share/${media.shareToken}/asset`
});

function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function issueToken() { return crypto.randomBytes(32).toString('base64url'); }
function publicUser(user) { return { id: user._id.toString(), email: user.email }; }

async function authRequired(req, res, next) {
  try {
    const match = /^Bearer\s+([A-Za-z0-9_-]{40,})$/.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ message: 'Please sign in to continue.' });
    const user = await User.findOne({ sessionTokenHash: tokenHash(match[1]), sessionExpiresAt: { $gt: new Date() } });
    if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.user = user;
    req.sessionToken = match[1];
    return next();
  } catch (error) { return next(error); }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    const token = issueToken();
    const user = await User.create({ email, passwordHash: `${salt}:${derived.toString('hex')}`, sessionTokenHash: tokenHash(token), sessionExpiresAt: new Date(Date.now() + MAX_AGE_MS) });
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
    return next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) return res.status(401).json({ message: 'Email or password is incorrect.' });
    const [salt, storedHex] = user.passwordHash.split(':');
    const derived = await scrypt(password, salt, 64);
    const stored = Buffer.from(storedHex, 'hex');
    if (stored.length !== derived.length || !crypto.timingSafeEqual(stored, derived)) return res.status(401).json({ message: 'Email or password is incorrect.' });
    const token = issueToken();
    user.sessionTokenHash = tokenHash(token);
    user.sessionExpiresAt = new Date(Date.now() + MAX_AGE_MS);
    await user.save();
    return res.json({ token, user: publicUser(user) });
  } catch (error) { return next(error); }
});

app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/logout', authRequired, async (req, res, next) => {
  try {
    req.user.sessionTokenHash = null;
    req.user.sessionExpiresAt = null;
    await req.user.save();
    return res.json({ message: 'Signed out.' });
  } catch (error) { return next(error); }
});

app.post('/api/media/upload', authRequired, (req, res, next) => {
  upload.single('file')(req, res, async err => {
    if (err) return next(err);
    try {
      if (!req.file) return res.status(400).json({ message: 'Please choose an image or video file.' });
      const minutes = Number(req.body.expiryMinutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 525600) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'expiryMinutes must be between 1 and 525600.' });
      }
      const media = await Media.create({
        owner: req.user._id,
        shareToken: issueToken(),
        originalName: path.basename(req.file.originalname), filename: req.file.filename,
        fileSize: req.file.size, mimeType: req.file.mimetype,
        expiresAt: new Date(Date.now() + minutes * 60 * 1000)
      });
      return res.status(201).json({ message: 'Upload successful', media: metadata(media) });
    } catch (error) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return next(error);
    }
  });
});

// Private owner dashboard only returns records belonging to the signed-in account.
app.get('/api/media', authRequired, async (req, res, next) => {
  try {
    const media = await Media.find({ owner: req.user._id }).select('+shareToken').sort({ createdAt: -1 }).limit(100);
    return res.json({ media: media.map(metadata) });
  } catch (error) { return next(error); }
});

// Public share metadata endpoint. The 256-bit random token is the bearer link.
app.get('/api/share/:token', async (req, res, next) => {
  try {
    const media = await Media.findOne({ shareToken: req.params.token }).select('+shareToken');
    if (!media || media.isRevoked || expired(media)) return res.status(404).json({ message: 'This link has expired or been revoked' });
    await Media.updateOne({ _id: media._id, isRevoked: false, expiresAt: { $gt: new Date() } }, { $inc: { viewCount: 1 } });
    media.viewCount += 1;
    return res.json({ media: metadata(media) });
  } catch (error) { return next(error); }
});

app.get('/api/share/:token/asset', async (req, res, next) => {
  try {
    const media = await Media.findOne({ shareToken: req.params.token }).select('+shareToken');
    if (!media || media.isRevoked || expired(media)) return res.status(404).json({ message: 'This link has expired or been revoked' });
    const filePath = path.join(UPLOAD_DIR, media.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Media file not found' });
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) { return next(error); }
});

// Owners can revoke only their own files. The filesystem file is deleted as well.
app.delete('/api/media/:id', authRequired, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Media not found' });
    const media = await Media.findOne({ _id: req.params.id, owner: req.user._id });
    if (!media) return res.status(404).json({ message: 'Media not found' });
    media.isRevoked = true;
    await media.save();
    await fs.promises.unlink(path.join(UPLOAD_DIR, media.filename)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    return res.json({ message: 'Media revoked and file deleted', id: media._id.toString() });
  } catch (error) { return next(error); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File exceeds the 10 MB limit.' });
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message });
  if (err.message === 'Only image and video files are accepted') return res.status(400).json({ message: err.message });
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/media_hosting');
  app.listen(PORT, '0.0.0.0', () => console.log(`Media API listening on ${PORT}`));
}
if (require.main === module) start().catch(error => { console.error('MongoDB connection failed:', error); process.exit(1); });
module.exports = app;
