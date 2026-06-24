/**
 * ══════════════════════════════════════════════
 *  ANA — Configurador de Modelo IA
 *  script.js  (hardened v2)
 * ══════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const CONFIG = {
  BACKEND_URL: 'https://17fc-186-28-189-44.ngrok-free.app/empresa',

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

  SOCIAL_PATTERNS: {
    instagram: /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,50}\/?$/,
    facebook:  /^https:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.%-]{1,100}\/?$/,
    linkedin:  /^https:\/\/(www\.)?linkedin\.com\/(company|in|school)\/[a-zA-Z0-9_%-]{1,100}\/?$/,
    github:    /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]{1,100}\/?$/,
    whatsapp:  /^(\+\d{7,15}|https:\/\/(wa\.me|api\.whatsapp\.com\/send)\/.+)$/,
  },

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

  /**
   * Limpia un string para uso seguro dentro de JSON.
   * Elimina:
   *   - Caracteres de control ASCII (U+0000–U+001F, U+007F)
   *   - Separadores de línea unicode que rompen algunos parsers JSON
   *     (U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR)
   *   - Caracteres nulos embebidos
   * NO codifica HTML; ese contexto lo maneja el DOM directamente.
   */
  cleanForJson(str) {
    if (typeof str !== 'string') return '';
    return str
      // Caracteres de control ASCII excepto \t (U+0009), \n (U+000A), \r (U+000D)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Separadores de línea unicode (peligrosos en JSON embebido en JS)
      .replace(/\u2028|\u2029/g, '')
      // Nulos embebidos
      .replace(/\0/g, '');
  },

  /**
   * Recorta al límite indicado DESPUÉS de limpiar para JSON.
   * Uso: cualquier string que termine en el payload.
   */
  truncate(str, maxLen) {
    if (typeof str !== 'string') return '';
    return Security.cleanForJson(str).slice(0, maxLen);
  },

  /**
   * Limpia para JSON y también recorta.
   * Alias semántico para mayor claridad en los puntos de llamada.
   */
  sanitizeForJson(str, maxLen) {
    return Security.truncate(str, maxLen ?? Infinity);
  },

  /** Valida extensión y tamaño de un File. */
  validateFile(file, allowedExts) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      return { ok: false, msg: `Tipo no permitido. Permitidos: ${allowedExts.join(', ')}` };
    }
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, msg: `El archivo supera el límite de ${CONFIG.MAX_FILE_SIZE_MB} MB.` };
    }
    return { ok: true };
  },

  /** Valida la URL de una red social según su patrón. */
  validateSocialUrl(network, value) {
    if (!value) return true;
    const pattern = CONFIG.SOCIAL_PATTERNS[network];
    return pattern ? pattern.test(value.trim()) : false;
  },

  /** Valida que un color sea un hex válido de 6 dígitos. */
  validateColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#3DBA65';
  },

  /** Construye el payload seguro para el backend. */
  buildPayload() {
    const activeSocials = {};
    for (const [net, data] of Object.entries(state.socials)) {
      if (data.enabled && data.url) {
        // URL ya fue validada al ingresarla; la limpiamos para JSON igualmente
        activeSocials[net] = Security.sanitizeForJson(data.url, CONFIG.MAX_LENGTHS.socialUrl);
      }
    }

    return {
      name:        Security.sanitizeForJson(state.name,         CONFIG.MAX_LENGTHS.modelName),
      company:     Security.sanitizeForJson(state.company,      CONFIG.MAX_LENGTHS.companyName),
      color:       Security.validateColor(state.color),
      tone:        state.tone.map(t  => Security.sanitizeForJson(t, 50)),
      voice:       state.voice.map(v => Security.sanitizeForJson(v, 50)),
      lang:        Security.sanitizeForJson(state.lang, 50),
      tags:        state.tags.map(t  => Security.sanitizeForJson(t, CONFIG.MAX_LENGTHS.tag)),
      restrictions:Security.sanitizeForJson(state.restrictions, CONFIG.MAX_LENGTHS.restrictions),
      role:        Security.sanitizeForJson(state.role, 80),
      companyInfo: {
        biz:     Security.sanitizeForJson(state.companyInfo.biz     || '', CONFIG.MAX_LENGTHS.companyBiz),
        does:    Security.sanitizeForJson(state.companyInfo.does    || '', CONFIG.MAX_LENGTHS.companyDoes),
        vision:  Security.sanitizeForJson(state.companyInfo.vision  || '', CONFIG.MAX_LENGTHS.companyVision),
        mission: Security.sanitizeForJson(state.companyInfo.mission || '', CONFIG.MAX_LENGTHS.companyMission),
        values:  Security.sanitizeForJson(state.companyInfo.values  || '', CONFIG.MAX_LENGTHS.companyValues),
      },
      socials:  activeSocials,
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
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    return response.json();
  },
};

/* ─────────────────────────────────────────────
   DOM HELPERS — sin innerHTML con datos del usuario
───────────────────────────────────────────── */

/** Crea un elemento de forma segura, sin innerHTML. */
function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className')       el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'title')      el.title = v;
    else if (k === 'href')       el.href = v;
    else if (k === 'target')     el.target = v;
    else if (k === 'rel')        el.rel = v;
    else if (k === 'ariaLabel')  el.setAttribute('aria-label', v);
    else                          el.setAttribute(k, v);
  }
  for (const child of children) el.appendChild(child);
  return el;
}

/* ─────────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────────── */
function updateOrbMeta() {
  state.company = Security.sanitizeForJson(
    document.getElementById('companyName').value.trim(),
    CONFIG.MAX_LENGTHS.companyName
  );
  renderOrb();
}

function renderOrb() {
  document.getElementById('orbLabel').textContent  = state.name;
  document.getElementById('orbStatus').textContent = state.isActive
    ? '● Modelo activo'
    : (state.company ? `Activo · ${state.company}` : 'En espera de configuración');

  const c = state.color;
  document.getElementById('mainOrb').style.background =
    `radial-gradient(circle at 38% 35%, rgba(255,255,255,.7) 0%, ${c}cc 45%, ${c} 80%, ${c}dd 100%)`;
}

/* ─────────────────────────────────────────────
   COLOR SYNC
───────────────────────────────────────────── */
function syncColor(input) {
  state.color = Security.validateColor(input.value);
  document.getElementById('modelColorHex').value = state.color;
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
    state.voice = [Security.sanitizeForJson(btn.textContent.trim(), 50)];
  } else {
    btn.classList.toggle('active');
    state.tone = [...container.querySelectorAll('.chip.active')]
      .map(c => Security.sanitizeForJson(c.textContent.trim(), 50));
  }
}

/* ─────────────────────────────────────────────
   ROLES
───────────────────────────────────────────── */
function selectRole(card) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  state.role = Security.sanitizeForJson(
    card.querySelector('.role-name').textContent.trim(),
    80
  );
}

/* ─────────────────────────────────────────────
   TAGS
   Uso de WeakMap para asociar tags a botones sin exponer datos en atributos.
───────────────────────────────────────────── */
const tagButtonMap = new Map(); // tag string → button element

function focusTagInput() {
  document.getElementById('tagInput').focus();
}

function handleTagKey(e) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();

  const input = e.target;
  const raw   = input.value.trim();
  if (!raw) return;

  const tag = Security.sanitizeForJson(raw, CONFIG.MAX_LENGTHS.tag);
  if (!tag || state.tags.includes(tag)) { input.value = ''; return; }
  if (state.tags.length >= 20) return;

  state.tags.push(tag);
  renderTag(tag);
  input.value = '';
}

function renderTag(tag) {
  const container = document.getElementById('tagContainer');

  // Botón de eliminar — sin atributos que contengan el valor del tag
  const removeBtn = createElement('button', { ariaLabel: `Eliminar tag ${tag}` });
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeTag(removeBtn, tag));

  const el = createElement('span', { className: 'tag' }, [removeBtn]);
  // Insertar el texto ANTES del botón usando un TextNode
  el.insertBefore(document.createTextNode(tag), removeBtn);

  container.insertBefore(el, document.getElementById('tagInput'));
  tagButtonMap.set(tag, el);
}

function removeTag(btn, tag) {
  const el = btn.closest('.tag') || tagButtonMap.get(tag);
  if (el) el.remove();
  tagButtonMap.delete(tag);
  state.tags = state.tags.filter(t => t !== tag);
}

/* ─────────────────────────────────────────────
   DOCS
───────────────────────────────────────────── */
const docElementMap = new Map(); // filename → DOM element

function handleDocs(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const check = Security.validateFile(file, CONFIG.ALLOWED_DOC_TYPES);
    if (!check.ok) { alert(check.msg); return; }

    // Sanitizar nombre antes de almacenar (nunca va a HTML directamente)
    const safeName = Security.sanitizeForJson(file.name, 255);
    if (!safeName || state.docs.find(d => d.name === safeName)) return;

    state.docs.push({ name: safeName, size: file.size });
    renderDocItem(safeName);
  });
}

function renderDocItem(name) {
  const list = document.getElementById('docList');

  const removeBtn = createElement('button', {
    className: 'doc-remove',
    ariaLabel: `Eliminar ${name}`,
  });
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeDoc(removeBtn, name));

  const nameSpan = createElement('span', { title: name });
  nameSpan.textContent = name;

  const item = createElement('div', { className: 'doc-item' }, [nameSpan, removeBtn]);
  list.appendChild(item);
  docElementMap.set(name, item);
}

function removeDoc(btn, name) {
  const el = docElementMap.get(name) || btn.closest('.doc-item');
  if (el) el.remove();
  docElementMap.delete(name);
  state.docs = state.docs.filter(d => d.name !== name);
}

/* ─────────────────────────────────────────────
   INVENTARIO
───────────────────────────────────────────── */
function handleInvFile(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const check = Security.validateFile(file, CONFIG.ALLOWED_INV_TYPES);
  if (!check.ok) { alert(check.msg); event.target.value = ''; return; }

  const safeName = Security.sanitizeForJson(file.name, 255);
  const nameEl   = document.getElementById(type === 'own' ? 'ownInvName' : 'extInvName');
  nameEl.textContent = safeName;   // textContent, nunca innerHTML
  nameEl.style.display = 'block';

  if (type === 'own') state.inventory.own = { name: safeName, size: file.size };
}

function connectInv(type) {
  const btn = document.getElementById(type === 'own' ? 'ownConnectBtn' : 'extConnectBtn');
  btn.classList.toggle('connected');
  btn.textContent = btn.classList.contains('connected')
    ? (type === 'own' ? '✓ Inventario conectado' : '✓ Fuente conectada')
    : (type === 'own' ? 'Conectar inventario'    : 'Conectar fuente externa');
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
function onSocialInput(input) {
  const network = input.dataset.network;
  // Truncar primero para que el campo no acumule basura
  const value   = Security.sanitizeForJson(input.value, CONFIG.MAX_LENGTHS.socialUrl);
  input.value   = value;

  state.socials[network].url = value;

  const row    = input.closest('.social-row');
  const toggle = document.getElementById(`tog-${network}`);

  const isValid = Security.validateSocialUrl(network, value);

  if (value && !isValid) {
    row.classList.add('has-error');
    toggle.checked  = false;
    toggle.disabled = true;
    state.socials[network].enabled = false;
  } else {
    row.classList.remove('has-error');
    toggle.disabled = false;
    toggle.checked  = !!value;
    state.socials[network].enabled = !!value;
  }

  renderSocialPreview();
}

function onSocialToggle(toggle) {
  const network  = toggle.dataset.network;
  const row      = toggle.closest('.social-row');
  const urlInput = row.querySelector('.social-url');
  const url      = Security.sanitizeForJson(urlInput.value.trim(), CONFIG.MAX_LENGTHS.socialUrl);

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

/** Renderiza las píldoras de redes activas — sin innerHTML con datos del usuario. */
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

  // Limpiar el contenedor de forma segura
  while (container.firstChild) container.removeChild(container.firstChild);

  if (!active.length) {
    const empty = createElement('span', { className: 'social-preview-empty' });
    empty.textContent = 'Ninguna red habilitada aún.';
    container.appendChild(empty);
    return;
  }

  for (const [net, data] of active) {
    // La URL ya fue validada con la regex estricta de cada red;
    // aun así la pasamos por sanitizeForJson antes de ponerla en href.
    const safeUrl = Security.sanitizeForJson(data.url, CONFIG.MAX_LENGTHS.socialUrl);

    // Defensa extra: sólo permitir URLs que comiencen con https://
    const pill = createElement('a', {
      className: 'social-pill',
      href:      safeUrl.startsWith('https://') ? safeUrl : '#',
      target:    '_blank',
      rel:       'noopener noreferrer',
    });
    pill.textContent = LABELS[net];
    container.appendChild(pill);
  }
}

/* ─────────────────────────────────────────────
   GUARDAR CONFIGURACIÓN
───────────────────────────────────────────── */
async function saveConfig() {
  const btn = document.querySelector('.save-btn');

  // Validar redes habilitadas
  for (const [net, data] of Object.entries(state.socials)) {
    if (data.enabled && !Security.validateSocialUrl(net, data.url)) {
      alert(`La URL de ${net} no es válida. Corregila antes de guardar.`);
      return;
    }
  }

  // Volcar DOM → estado con sanitización
  state.name     = Security.sanitizeForJson(
    document.getElementById('modelName').value.trim() || 'Modelo sin nombre',
    CONFIG.MAX_LENGTHS.modelName
  );
  state.lang     = Security.sanitizeForJson(
    document.getElementById('modelLang').value,
    50
  );
  state.restrictions = Security.sanitizeForJson(
    document.getElementById('restrictions').value,
    CONFIG.MAX_LENGTHS.restrictions
  );
  state.companyInfo  = {
    biz:     document.getElementById('companyBiz').value,
    does:    document.getElementById('companyDoes').value,
    vision:  document.getElementById('companyVision').value,
    mission: document.getElementById('companyMission').value,
    values:  document.getElementById('companyValues').value,
    // La sanitización final ocurre en buildPayload()
  };

  const payload = Security.buildPayload();

  btn.textContent = 'Guardando…';
  btn.disabled    = true;

  try {
    await ApiClient.saveConfig(payload);
    btn.textContent = `✓ ${state.name} guardado`;
  } catch (err) {
    console.error('[ANA] saveConfig error:', err);
    btn.textContent = 'Error al guardar';
  } finally {
    setTimeout(() => { btn.textContent = 'Guardar modelo'; btn.disabled = false; }, 3000);
  }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('modelName').addEventListener('input', e => {
    state.name = Security.sanitizeForJson(
      e.target.value.trim() || 'Modelo sin nombre',
      CONFIG.MAX_LENGTHS.modelName
    );
    renderOrb();
  });

  document.getElementById('modelColor').addEventListener('input', e => {
    state.color = Security.validateColor(e.target.value);
    document.getElementById('modelColorHex').value = state.color;
    renderOrb();
  });

  document.getElementById('companyName').addEventListener('input', updateOrbMeta);

  document.getElementById('modelLang').addEventListener('change', e => {
    state.lang = Security.sanitizeForJson(e.target.value, 50);
  });

  document.getElementById('restrictions').addEventListener('input', e => {
    state.restrictions = Security.sanitizeForJson(
      e.target.value,
      CONFIG.MAX_LENGTHS.restrictions
    );
  });

  ['ownInvDrop','extInvDrop'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop',      e => { e.preventDefault(); el.classList.remove('drag-over'); });
  });

  renderOrb();
});
