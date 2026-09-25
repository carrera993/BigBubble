// app.js
// Configurá esta URL apuntando a tu backend desplegado (ver README para instrucciones de deploy).
const API_URL = window.BIGBUBBLE_API_URL || 'http://localhost:4000/api';
const ORIGIN = API_URL.replace(/\/api$/, '');

let token = localStorage.getItem('bb_token') || null;
let currentUser = JSON.parse(localStorage.getItem('bb_user') || 'null');

const $ = (sel) => document.querySelector(sel);

// ---------- API helper ----------
function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(options.headers || {}),
    },
    body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Error de red');
  return data;
}

function photoUrl(path) {
  return path ? `${ORIGIN}${path}` : null;
}

function saveSession(t, user) {
  token = t;
  currentUser = user;
  localStorage.setItem('bb_token', t);
  localStorage.setItem('bb_user', JSON.stringify(user));
}

function clearSession() {
  token = null;
  currentUser = null;
  localStorage.removeItem('bb_token');
  localStorage.removeItem('bb_user');
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function avatarEl(user, size = '') {
  const url = photoUrl(user.profilePhoto);
  return `<div class="avatar ${size}">${
    url ? `<img src="${url}" alt="">` : initials(user.displayName || user.username)
  }</div>`;
}

// ---------- Íconos (SVG inline, no emojis: se ven igual en cualquier plataforma) ----------
const ICONS = {
  heart:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled:
    '<svg class="icon filled" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  repeat:
    '<svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  bell:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  camera:
    '<svg class="icon small" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  sun:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  logout:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  trash:
    '<svg class="icon small" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

// ---------- Modo nocturno ----------
function initTheme() {
  const saved = localStorage.getItem('bb_theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bb_theme', next);
  updateThemeButton();
}

function updateThemeButton() {
  const btn = $('#theme-btn');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
  btn.title = isDark ? 'Activar modo claro' : 'Activar modo nocturno';
}

initTheme();

// ---------- Router simple basado en hash ----------
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return { name: 'home' };
  if (hash.startsWith('u/')) return { name: 'profile', username: hash.slice(2) };
  if (hash === 'notifications') return { name: 'notifications' };
  return { name: 'home' };
}

window.addEventListener('hashchange', render);

// ---------- Topbar ----------
async function renderTopbar() {
  const el = $('#topbar-actions');

  let notifBtnHtml = '';
  if (currentUser) {
    let unread = 0;
    try {
      const data = await api('/notifications');
      unread = data.unreadCount;
    } catch (e) {
      /* silencioso: si falla, simplemente no mostramos el contador */
    }
    notifBtnHtml = `
      <button class="icon-btn" id="notif-btn" title="Notificaciones" aria-label="Notificaciones">
        ${ICONS.bell} ${unread > 0 ? `<span class="badge">${unread}</span>` : ''}
      </button>
      <a href="#/u/${currentUser.username}" class="icon-btn" title="Mi perfil">${avatarEl(
      currentUser,
      'small'
    )}</a>
      <button class="icon-btn" id="logout-btn" title="Salir" aria-label="Cerrar sesión">${ICONS.logout}</button>
    `;
  }

  el.innerHTML = `
    <button class="icon-btn" id="theme-btn" title="Cambiar tema" aria-label="Cambiar tema"></button>
    ${notifBtnHtml}
  `;

  $('#theme-btn').onclick = toggleTheme;
  updateThemeButton();

  if (currentUser) {
    $('#notif-btn').onclick = () => (location.hash = '#/notifications');
    $('#logout-btn').onclick = () => {
      clearSession();
      location.hash = '#/';
      render();
    };
  }
}

// ---------- Búsqueda ----------
let searchTimer = null;
$('#search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) {
    $('#search-results').classList.add('hidden');
    return;
  }
  searchTimer = setTimeout(async () => {
    const data = await api(`/users/search?q=${encodeURIComponent(q)}`);
    const box = $('#search-results');
    if (data.users.length === 0) {
      box.innerHTML = '<div class="search-result-item">Sin resultados</div>';
    } else {
      box.innerHTML = data.users
        .map(
          (u) => `
        <div class="search-result-item" data-username="${u.username}">
          ${avatarEl(u, 'small')}
          <div><b>${u.displayName}</b><br><span style="color:var(--muted);font-size:12px">@${u.username}</span></div>
        </div>`
        )
        .join('');
      box.querySelectorAll('.search-result-item[data-username]').forEach((item) => {
        item.onclick = () => {
          location.hash = `#/u/${item.dataset.username}`;
          box.classList.add('hidden');
          $('#search-input').value = '';
        };
      });
    }
    box.classList.remove('hidden');
  }, 300);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) $('#search-results').classList.add('hidden');
});

// ---------- Feed items (bubbles + reposts) ----------
function feedItemEl(item) {
  const b = item.bubble;
  const mine = currentUser && b.author.id === currentUser.id;
  const div = document.createElement('div');
  div.className = 'bubble';

  const repostTag =
    item.type === 'repost'
      ? `<div class="repost-tag">${ICONS.repeat.replace('class="icon"', 'class="icon small"')} ${item.repostedBy.displayName} reposteó</div>`
      : '';

  div.innerHTML = `
    ${avatarEl(b.author)}
    <div class="bubble-body">
      ${repostTag}
      <div class="bubble-header">
        <span class="display-name" data-username="${b.author.username}">${b.author.displayName}</span>
        <span class="username" data-username="${b.author.username}">@${b.author.username}</span>
        <span class="time">· ${timeAgo(b.createdAt)}</span>
      </div>
      <div class="bubble-content"></div>
      <div class="bubble-actions">
        <button class="action-btn like-btn ${b.likedByMe ? 'liked' : ''}" data-id="${b.id}" aria-label="Me gusta">
          ${ICONS.heart} <span class="like-count">${b.likeCount}</span>
        </button>
        <button class="action-btn repost-btn ${b.repostedByMe ? 'reposted' : ''}" data-id="${b.id}" aria-label="Repostear" ${
    mine ? 'disabled title="No podés repostear tu propio bubble"' : ''
  }>
          ${ICONS.repeat} <span class="repost-count">${b.repostCount}</span>
        </button>
        ${mine ? `<button class="action-btn delete-btn" data-id="${b.id}" aria-label="Borrar">${ICONS.trash}</button>` : ''}
      </div>
    </div>
  `;
  div.querySelector('.bubble-content').textContent = b.content;

  div.querySelectorAll('[data-username]').forEach((n) => {
    n.onclick = () => (location.hash = `#/u/${n.dataset.username}`);
  });

  div.querySelector('.like-btn').onclick = async () => {
    if (!currentUser) return alert('Iniciá sesión para dar like.');
    const res = await api(`/bubbles/${b.id}/like`, { method: 'POST' });
    const btn = div.querySelector('.like-btn');
    btn.classList.toggle('liked', res.likedByMe);
    btn.querySelector('.like-count').textContent = res.likeCount;
  };

  const repostBtn = div.querySelector('.repost-btn');
  if (!mine) {
    repostBtn.onclick = async () => {
      if (!currentUser) return alert('Iniciá sesión para repostear.');
      const res = await api(`/bubbles/${b.id}/repost`, { method: 'POST' });
      repostBtn.classList.toggle('reposted', res.repostedByMe);
      repostBtn.querySelector('.repost-count').textContent = res.repostCount;
    };
  }

  const delBtn = div.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.onclick = async () => {
      if (!confirm('¿Borrar este bubble?')) return;
      await api(`/bubbles/${b.id}`, { method: 'DELETE' });
      render();
    };
  }

  return div;
}

// ---------- Home (timeline) ----------
async function renderHome() {
  $('#profile-view').classList.add('hidden');
  $('#notif-panel').classList.add('hidden');
  $('#composer').classList.toggle('hidden', !currentUser);
  $('#auth-forms').classList.toggle('hidden', !!currentUser);

  const timeline = $('#timeline');
  timeline.classList.remove('hidden');
  const data = await api('/bubbles');
  timeline.innerHTML = '';
  data.feed.forEach((item) => timeline.appendChild(feedItemEl(item)));
}

// ---------- Perfil ----------
async function renderProfile(username) {
  $('#timeline').classList.add('hidden');
  $('#composer').classList.add('hidden');
  $('#auth-forms').classList.add('hidden');
  $('#notif-panel').classList.add('hidden');

  const view = $('#profile-view');
  view.classList.remove('hidden');
  view.innerHTML = '<p>Cargando...</p>';

  let data;
  try {
    data = await api(`/users/${username}`);
  } catch (err) {
    view.innerHTML = `<p class="card">Usuario no encontrado.</p>`;
    return;
  }

  const u = data.user;
  const isMe = currentUser && currentUser.username === u.username;

  view.innerHTML = `
    <div class="profile-header">
      <div class="profile-cover"></div>
      <div class="profile-info">
        <div class="avatar profile-avatar">${
          photoUrl(u.profilePhoto) ? `<img src="${photoUrl(u.profilePhoto)}">` : initials(u.displayName)
        }</div>
        <p class="profile-name">${u.displayName}</p>
        <p class="profile-username">@${u.username}</p>
        ${u.bio ? `<p class="profile-bio"></p>` : ''}
        <div class="profile-stats">
          <span><b>${u.followingCount}</b> siguiendo</span>
          <span><b>${u.followerCount}</b> seguidores</span>
        </div>
        <div class="profile-actions" id="profile-actions"></div>
      </div>
    </div>
    <div id="profile-feed"></div>
  `;
  if (u.bio) view.querySelector('.profile-bio').textContent = u.bio;

  const actions = $('#profile-actions');
  if (isMe) {
    actions.innerHTML = `
      <label class="photo-upload-label">
        ${ICONS.camera} Cambiar foto
        <input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden">
      </label>
      <button class="secondary small" id="edit-profile-btn">Editar perfil</button>
      <button class="danger small" id="delete-account-btn">Borrar cuenta</button>
    `;
    $('#photo-input').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('photo', file);
      try {
        await api('/users/me/photo', { method: 'POST', body: fd });
        const me = await api('/auth/me');
        saveSession(token, me.user);
        renderProfile(username);
        renderTopbar();
      } catch (err) {
        alert(err.message);
      }
    };
    $('#edit-profile-btn').onclick = () => openEditProfile(u);
    $('#delete-account-btn').onclick = async () => {
      if (!confirm('Esto borra tu cuenta y todo tu contenido de forma permanente. ¿Confirmás?')) return;
      await api('/users/me', { method: 'DELETE' });
      clearSession();
      location.hash = '#/';
      render();
    };
  } else if (currentUser) {
    actions.innerHTML = `
      <button class="${u.isFollowing ? 'secondary' : ''} small" id="follow-btn">
        ${u.isFollowing ? 'Siguiendo' : 'Seguir'}
      </button>
      ${
        u.isFollowing
          ? `<label class="notify-toggle">
              <input type="checkbox" id="notify-check" ${u.notify ? 'checked' : ''}>
              Avisarme cuando publique
            </label>`
          : ''
      }
    `;
    $('#follow-btn').onclick = async () => {
      const res = await api(`/users/follow/${u.id}`, { method: 'POST' });
      renderProfile(username);
    };
    const notifyCheck = $('#notify-check');
    if (notifyCheck) {
      notifyCheck.onchange = async (e) => {
        await api(`/users/follow/${u.id}/notify`, {
          method: 'PATCH',
          body: { notify: e.target.checked },
        });
      };
    }
  }

  const feedEl = $('#profile-feed');
  data.feed.forEach((item) => feedEl.appendChild(feedItemEl(item)));
  if (data.feed.length === 0) {
    feedEl.innerHTML = '<p class="card" style="text-align:center;color:var(--muted)">Todavía no hay nada para mostrar.</p>';
  }
}

function openEditProfile(u) {
  const view = $('#profile-view');
  const box = document.createElement('div');
  box.className = 'card';
  box.innerHTML = `
    <form id="edit-form" class="form">
      <input type="text" id="edit-name" value="${u.displayName}" maxlength="50" placeholder="Nombre" />
      <textarea id="edit-bio" maxlength="160" placeholder="Bio">${u.bio || ''}</textarea>
      <button type="submit">Guardar</button>
    </form>
  `;
  view.prepend(box);
  box.querySelector('#edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = box.querySelector('#edit-name').value.trim();
    const bio = box.querySelector('#edit-bio').value.trim();
    try {
      await api('/users/me', { method: 'PATCH', body: { displayName, bio } });
      const me = await api('/auth/me');
      saveSession(token, me.user);
      renderProfile(u.username);
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------- Notificaciones ----------
async function renderNotifications() {
  $('#timeline').classList.add('hidden');
  $('#composer').classList.add('hidden');
  $('#auth-forms').classList.add('hidden');
  $('#profile-view').classList.add('hidden');

  const panel = $('#notif-panel');
  panel.classList.remove('hidden');

  if (!currentUser) {
    panel.innerHTML = '<p>Iniciá sesión para ver tus notificaciones.</p>';
    return;
  }

  const data = await api('/notifications');
  await api('/notifications/read-all', { method: 'POST' });

  if (data.notifications.length === 0) {
    panel.innerHTML = '<h3>Notificaciones</h3><p style="color:var(--muted)">No tenés notificaciones todavía. Activalas desde el perfil de las personas que seguís.</p>';
    return;
  }

  panel.innerHTML =
    '<h3>Notificaciones</h3>' +
    data.notifications
      .map(
        (n) => `
      <div class="notif-item ${n.isRead ? '' : 'unread'}">
        ${avatarEl(n.actor, 'small')}
        <div>
          <div class="notif-text">
            <b data-username="${n.actor.username}" style="cursor:pointer">${n.actor.displayName}</b>
            publicó: "${(n.bubbleContent || '').slice(0, 80)}"
          </div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
      </div>`
      )
      .join('');

  panel.querySelectorAll('[data-username]').forEach((el) => {
    el.onclick = () => (location.hash = `#/u/${el.dataset.username}`);
  });

  renderTopbar();
}

// ---------- Auth forms ----------
$('#tab-login').onclick = () => {
  $('#tab-login').classList.add('active');
  $('#tab-register').classList.remove('active');
  $('#login-form').classList.remove('hidden');
  $('#register-form').classList.add('hidden');
};
$('#tab-register').onclick = () => {
  $('#tab-register').classList.add('active');
  $('#tab-login').classList.remove('active');
  $('#register-form').classList.remove('hidden');
  $('#login-form').classList.add('hidden');
};

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: {
        username: $('#login-username').value.trim(),
        password: $('#login-password').value,
      },
    });
    saveSession(data.token, data.user);
    location.hash = '#/';
    render();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#register-error').textContent = '';
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: {
        username: $('#reg-username').value.trim(),
        displayName: $('#reg-displayname').value.trim(),
        email: $('#reg-email').value.trim(),
        password: $('#reg-password').value,
      },
    });
    saveSession(data.token, data.user);
    location.hash = '#/';
    render();
  } catch (err) {
    $('#register-error').textContent = err.message;
  }
});

// ---------- Composer ----------
$('#bubble-content').addEventListener('input', (e) => {
  $('#char-count').textContent = 280 - e.target.value.length;
});

$('#post-btn').addEventListener('click', async () => {
  const content = $('#bubble-content').value.trim();
  if (!content) return;
  try {
    await api('/bubbles', { method: 'POST', body: { content } });
    $('#bubble-content').value = '';
    $('#char-count').textContent = '280';
    renderHome();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Render principal ----------
async function render() {
  await renderTopbar();
  const route = currentRoute();
  if (route.name === 'profile') return renderProfile(route.username);
  if (route.name === 'notifications') return renderNotifications();
  return renderHome();
}

render();
