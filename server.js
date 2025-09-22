const express = require('express');
const path = require('path');
const app = express();

// COOP/COEP headers cho SharedArrayBuffer
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Đường dẫn tuyệt đối
const publicPath = path.join(__dirname, 'public');
const buildPath = path.join(__dirname, 'build');

// Serve FFmpeg files từ public/ffmpeg
app.use(
  '/ffmpeg',
  express.static(path.join(publicPath, 'ffmpeg'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    },
  })
);

// Serve React build
app.use(express.static(buildPath));

// SPA fallback: tất cả request khác trả về index.html
app.get('/*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
