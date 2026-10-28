const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  shareToken: { type: String, required: true, unique: true, index: true, select: false },
  originalName: { type: String, required: true },
  filename: { type: String, required: true, unique: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  viewCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', mediaSchema);
