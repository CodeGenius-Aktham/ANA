/**
 * ══════════════════════════════════════════════
 *  ANA — Configurador de Modelo IA
 *  script.js
 * ══════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const CONFIG = {
  BACKEND_URL: 'https://3a2a-190-26-35-16.ngrok-free.app',

  // Longitudes máximas por campo (seguridad de input)
  MAX_LENGTHS: {
    modelName:      80,
    companyName:    120,
    companyBiz:     600,
    companyDoes:    600,
    companyVision:  200,
    companyMission: 200,
    companyValues:  200,
    restrictions:   800,
    tag:            40,
    socialUrl:      300,
  },

  // Patrones permitidos por red social
  SOCIAL_PATTERNS: {
    instagram: /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,50}\/?$/,
    facebook:  /^https:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.%-]{1,100}\/?$/,
    linkedin:  /^https:\/\/(www\.)?linkedin\.com\/(company|in|school)\/[a-zA-Z0-9_%-]{1,100}\/?$/,
    github:    /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]{1,100}\/?$/,
    whatsapp:  /^(\+\d{7,15}|https:\/\/(wa\.me|api\.whatsapp\.com\/send)\/.+)$/,
  },

  // Tipos de archivo permitidos por sección
  ALLOWED_DOC_TYPES:  ['.pdf','.doc','.docx','.txt','.csv'],
  ALLOWED_INV_TYPES:  ['.csv','.xlsx','.json'],
  MAX_FILE_SIZE_MB:   10,
};

/* ─────────────────────────────────────────────
   ESTADO
───────────────────────────────────────────── */
const state = {
  name:        'Modelo sin nombre',
  company:     '',
  color:       '#3DBA65',
  tone:        ['Profesional'],
  voice:       ['Femenina'],
  lang:        'Español',
  tags:        [],
  restrictions:'',
  role:        'Vendedor',
  companyInfo: {},
  docs:        [],
  inventory:   { own: null, external: { url: '', key: '' } },
  socials:     {
    instagram: { enabled: false, url: '' },
    facebook:  { enabled: false, url: '' },
    linkedin:  { enabled: false, url: '' },
    github:    { enabled: false, url: '' },
    whatsapp:  { enabled: false, url: '' },
  },
  isActive: false,
};

/* ─────────────────────────────────────────────
   UTILIDADES DE SEGURIDAD
───────────────────────────────────────────── */
const Security = {
  /** Elimina HTML/scripts de un string */
  sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  /** Recorta al límite indicado y elimina caracteres de control */
  truncate(str, maxLen) {
    if (typeof str !== 'string') return '';
    // eliminar caracteres de control (excepto \n, \r, \t)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return str.slice(0, maxLen);
  },

  /** Valida extensión y tamaño de un File */
  validateFile(file, allowedExts) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      return { ok: false, msg: `Tipo de archivo no permitido. Permitidos: ${allowedExts.join(', ')}` };
    }
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, msg: `El archivo supera el límite de ${CONFIG.MAX_FILE_SIZE_MB} MB.` };
    }
    return { ok: true };
  },

  /** Valida la URL de una red social según su patrón */
  validateSocialUrl(network, value) {
    if (!value) return true; // vacío es válido (se desactiva)
    const pattern = CONFIG.SOCIAL_PATTERNS[network];
    return pattern ? pattern.test(value.trim()) : false;
  },

  /** Construye el objeto a enviar al backend (sin datos sensibles en claro) */
  buildPayload() {
    const activeSocials = {};
    for (const [net, data] of Object.entries(state.socials)) {
      if (data.enabled && data.url) {
        activeSocials[net] = Security.sanitize(data.url);
      }
    }

    return {
      name:        Security.truncate(state.name, CONFIG.MAX_LENGTHS.modelName),
      company:     Security.truncate(state.company, CONFIG.MAX_LENGTHS.companyName),
      color:       /^#[0-9A-Fa-f]{6}$/.test(state.color) ? state.color : '#3DBA65',
      tone:        state.tone,
      voice:       state.voice,
      lang:        state.lang,
      tags:        state.tags.map(t => Security.truncate(t, CONFIG.MAX_LENGTHS.tag)),
      restrictions:Security.truncate(state.restrictions, CONFIG.MAX_LENGTHS.restrictions),
      role:        state.role,
      companyInfo: {
        biz:     Security.truncate(state.companyInfo.biz     || '', CONFIG.MAX_LENGTHS.companyBiz),
        does:    Security.truncate(state.companyInfo.does    || '', CONFIG.MAX_LENGTHS.companyDoes),
        vision:  Security.truncate(state.companyInfo.vision  || '', CONFIG.MAX_LENGTHS.companyVision),
        mission: Security.truncate(state.companyInfo.mission || '', CONFIG.MAX_LENGTHS.companyMission),
        values:  Security.truncate(state.companyInfo.values  || '', CONFIG.MAX_LENGTHS.companyValues),
      },
      socials: activeSocials,
      isActive: state.isActive,
    };
  },
};

/* ─────────────────────────────────────────────
   API CLIENT
───────────────────────────────────────────── */
const ApiClient = {
  async saveConfig(data) {
    const response = await fetch(`${CONFIG.BACKEND_URL}/carga`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    return await response.json();
  },

  async loadEmpresa(empresaData) {
    const response = await fetch(`${CONFIG.BACKEND_URL}/carga`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(empresaData),
    });
    if (!response.ok) throw new Error(`Error al cargar empresa: ${response.status}`);
    return await response.json();
  },
};

/* ─────────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────────── */
function updateOrbMeta() {
  state.company = Security.truncate(
    document.getElementById('companyName').value.trim(),
    CONFIG.MAX_LENGTHS.companyName
  );
  renderOrb();
}

function renderOrb() {
  document.getElementById('orbLabel').textContent  = state.name;
  document.getElementById('orbStatus').textContent = state.isActive
    ? '● Modelo activo'
    : (state.company ? `Activo · ${Security.sanitize(state.company)}` : 'En espera de configuración');

  const c = state.color;
  document.getElementById('mainOrb').style.background =
    `radial-gradient(circle at 38% 35%, rgba(255,255,255,.7) 0%, ${c}cc 45%, ${c} 80%, ${c}dd 100%)`;
}

/* ─────────────────────────────────────────────
   COLOR SYNC
───────────────────────────────────────────── */
function syncColor(input) {
  state.color = input.value;
  document.getElementById('modelColorHex').value = input.value;
  renderOrb();
}

function syncHex(input) {
  const val = input.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    state.color = val;
    document.getElementById('modelColor').value = val;
    renderOrb();
  }
}

/* ─────────────────────────────────────────────
   CHIPS (tono / voz)
───────────────────────────────────────────── */
function toggleChip(btn, group) {
  const container = document.getElementById(group === 'tone' ? 'toneGroup' : 'voiceGroup');
  if (group === 'voice') {
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.voice = [btn.textContent.trim()];
  } else {
    btn.classList.toggle('active');
    state.tone = [...container.querySelectorAll('.chip.active')].map(c => c.textContent.trim());
  }
}

/* ─────────────────────────────────────────────
   ROLES
───────────────────────────────────────────── */
function selectRole(card) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  state.role = card.querySelector('.role-name').textContent.trim();
}

/* ─────────────────────────────────────────────
   TAGS
───────────────────────────────────────────── */
function focusTagInput() {
  document.getElementById('tagInput').focus();
}

function handleTagKey(e) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const input = e.target;
  const raw   = input.value.trim();
  if (!raw) return;

  const tag = Security.truncate(raw, CONFIG.MAX_LENGTHS.tag);
  if (state.tags.includes(tag)) { input.value = ''; return; }
  if (state.tags.length >= 20) return; // límite de tags

  state.tags.push(tag);
  renderTag(tag);
  input.value = '';
}

function renderTag(tag) {
  const container = document.getElementById('tagContainer');
  const el = document.createElement('span');
  el.className = 'tag';
  el.innerHTML = `${Security.sanitize(tag)}<button onclick="removeTag(this,'${Security.sanitize(tag)}')" aria-label="Eliminar tag ${Security.sanitize(tag)}">×</button>`;
  container.insertBefore(el, document.getElementById('tagInput'));
}

function removeTag(btn, tag) {
  btn.parentElement.remove();
  state.tags = state.tags.filter(t => t !== tag);
}

/* ─────────────────────────────────────────────
   DOCS
───────────────────────────────────────────── */
function handleDocs(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const check = Security.validateFile(file, CONFIG.ALLOWED_DOC_TYPES);
    if (!check.ok) { alert(check.msg); return; }
    if (state.docs.find(d => d.name === file.name)) return; // deduplicar
    state.docs.push({ name: file.name, size: file.size });
    renderDocItem(file.name);
  });
}

function renderDocItem(name) {
  const list = document.getElementById('docList');
  const item = document.createElement('div');
  item.className = 'doc-item';
  item.innerHTML = `<span title="${Security.sanitize(name)}">${Security.sanitize(name)}</span>
    <button class="doc-remove" onclick="removeDoc(this,'${Security.sanitize(name)}')" aria-label="Eliminar ${Security.sanitize(name)}">×</button>`;
  list.appendChild(item);
}

function removeDoc(btn, name) {
  btn.parentElement.remove();
  state.docs = state.docs.filter(d => d.name !== name);
}

/* ─────────────────────────────────────────────
   INVENTARIO
───────────────────────────────────────────── */
function handleInvFile(event, type) {
  const file  = event.target.files[0];
  if (!file) return;
  const check = Security.validateFile(file, CONFIG.ALLOWED_INV_TYPES);
  if (!check.ok) { alert(check.msg); event.target.value = ''; return; }

  const nameEl = document.getElementById(type === 'own' ? 'ownInvName' : 'extInvName');
  nameEl.textContent = file.name;
  nameEl.style.display = 'block';

  if (type === 'own') state.inventory.own = { name: file.name, size: file.size };
}

function connectInv(type) {
  const btn = document.getElementById(type === 'own' ? 'ownConnectBtn' : 'extConnectBtn');
  btn.classList.toggle('connected');
  btn.textContent = btn.classList.contains('connected')
    ? (type === 'own' ? '✓ Inventario conectado' : '✓ Fuente conectada')
    : (type === 'own' ? 'Conectar inventario' : 'Conectar fuente externa');
}

/* ─────────────────────────────────────────────
   ORB ACTIVATE
───────────────────────────────────────────── */
function activateOrb() {
  state.isActive = !state.isActive;
  renderOrb();
}

/* ─────────────────────────────────────────────
   REDES SOCIALES
───────────────────────────────────────────── */

/** Se llama al cambiar el valor de una URL de red social */
function onSocialInput(input) {
  const network = input.dataset.network;
  const value   = Security.truncate(input.value, CONFIG.MAX_LENGTHS.socialUrl);
  input.value   = value; // refleja el truncado

  state.socials[network].url = value;

  const row = input.closest('.social-row');
  const toggle = document.getElementById(`tog-${network}`);

  if (value && !Security.validateSocialUrl(network, value)) {
    row.classList.add('has-error');
    // Si la URL es inválida, deshabilitar el toggle y desactivar
    toggle.checked = false;
    toggle.disabled = true;
    state.socials[network].enabled = false;
  } else {
    row.classList.remove('has-error');
    toggle.disabled = false;
    // Si hay URL válida, activar automáticamente
    if (value) {
      toggle.checked = true;
      state.socials[network].enabled = true;
    } else {
      // URL vacía — desactivar
      toggle.checked = false;
      state.socials[network].enabled = false;
    }
  }
  renderSocialPreview();
}

/** Se llama al cambiar el toggle de una red social */
function onSocialToggle(toggle) {
  const network = toggle.dataset.network;
  const row     = toggle.closest('.social-row');
  const urlInput = row.querySelector('.social-url');
  const url      = urlInput.value.trim();

  // No permitir activar sin URL válida
  if (toggle.checked) {
    if (!url) {
      alert('Ingresá una URL antes de activar esta red.');
      toggle.checked = false;
      return;
    }
    if (!Security.validateSocialUrl(network, url)) {
      alert('La URL ingresada no es válida para esta red social.');
      toggle.checked = false;
      return;
    }
  }
  state.socials[network].enabled = toggle.checked;
  renderSocialPreview();
}

/** Renderiza las píldoras de preview de redes activas */
function renderSocialPreview() {
  const container = document.getElementById('socialPreview');
  const LABELS = {
    instagram: '📸 Instagram',
    facebook:  '📘 Facebook',
    linkedin:  '💼 LinkedIn',
    github:    '🐙 GitHub',
    whatsapp:  '💬 WhatsApp',
  };

  const active = Object.entries(state.socials)
    .filter(([, data]) => data.enabled && data.url);

  if (!active.length) {
    container.innerHTML = '<span class="social-preview-empty">Ninguna red habilitada aún.</span>';
    return;
  }

  container.innerHTML = active.map(([net, data]) => {
    const safeUrl = Security.sanitize(data.url);
    return `<a class="social-pill" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${LABELS[net]}</a>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   GUARDAR CONFIGURACIÓN
───────────────────────────────────────────── */
async function saveConfig() {
  const btn = document.querySelector('.save-btn');

  // Validar todas las redes habilitadas antes de guardar
  for (const [net, data] of Object.entries(state.socials)) {
    if (data.enabled && !Security.validateSocialUrl(net, data.url)) {
      alert(`La URL de ${net} no es válida. Corregila antes de guardar.`);
      return;
    }
  }

  // Recopilar campos del DOM al estado antes de enviar
  state.name        = Security.truncate(document.getElementById('modelName').value.trim() || 'Modelo sin nombre', CONFIG.MAX_LENGTHS.modelName);
  state.lang        = document.getElementById('modelLang').value;
  state.restrictions= Security.truncate(document.getElementById('restrictions').value, CONFIG.MAX_LENGTHS.restrictions);
  state.companyInfo = {
    biz:     document.getElementById('companyBiz').value,
    does:    document.getElementById('companyDoes').value,
    vision:  document.getElementById('companyVision').value,
    mission: document.getElementById('companyMission').value,
    values:  document.getElementById('companyValues').value,
  };

  const payload = Security.buildPayload();

  btn.textContent = 'Guardando…';
  btn.disabled    = true;

  try {
    await ApiClient.saveConfig(payload);
    btn.textContent = `✓ ${state.name} guardado`;
    setTimeout(() => { btn.textContent = 'Guardar modelo'; btn.disabled = false; }, 3000);
  } catch (err) {
    console.error(err);
    btn.textContent = 'Error al guardar';
    setTimeout(() => { btn.textContent = 'Guardar modelo'; btn.disabled = false; }, 3000);
  }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* Nombre del modelo → orb */
  document.getElementById('modelName').addEventListener('input', e => {
    state.name = Security.truncate(e.target.value.trim() || 'Modelo sin nombre', CONFIG.MAX_LENGTHS.modelName);
    renderOrb();
  });

  /* Color → orb */
  document.getElementById('modelColor').addEventListener('input', e => {
    state.color = e.target.value;
    document.getElementById('modelColorHex').value = e.target.value;
    renderOrb();
  });

  /* Empresa → orb */
  document.getElementById('companyName').addEventListener('input', () => updateOrbMeta());

  /* Idioma */
  document.getElementById('modelLang').addEventListener('change', e => {
    state.lang = e.target.value;
  });

  /* Restricciones */
  document.getElementById('restrictions').addEventListener('input', e => {
    state.restrictions = Security.truncate(e.target.value, CONFIG.MAX_LENGTHS.restrictions);
  });

  /* Drag & drop visual para uploads */
  ['ownInvDrop','extInvDrop'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop',      e => { e.preventDefault(); el.classList.remove('drag-over'); });
  });

  renderOrb();
});