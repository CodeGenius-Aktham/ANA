/**
 * ══════════════════════════════════════════════
 *  ANA — Configurador de Modelo IA
 *  script.js  (hardened v4 · dual-client · inventario conectable)
 * ══════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const CONFIG = {
  /**
   * Base de la API. Todos los clientes lo usan.
   *
   * Endpoints de empresa:
   *   GET    BASE_URL + /empresa/search/<nombre_empresa>
   *   POST   BASE_URL + /empresa/carga
   *   PUT    BASE_URL + /empresa/update/<nombre_empresa>
   *   DELETE BASE_URL + /empresa/delete/<nombre_empresa>
   *
   * Endpoints de inventario:
   *   GET    BASE_URL + /inventario/inventory/<nombre_empresa> — trae solo el inventario
   *   POST   BASE_URL + /inventario/propio      (multipart, campo "inventory")
   *   POST   BASE_URL + /inventario/externo/test (JSON { url, key }) — valida credenciales
   *   POST   BASE_URL + /inventario/externo      (JSON { url, key }) — guarda la conexión
   *   DELETE BASE_URL + /inventario/propio
   *   DELETE BASE_URL + /inventario/externo
   */
  BASE_URL: 'https://7e09-190-24-70-29.ngrok-free.app',

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
    invUrl:         300,
    invKey:         200,
  },

  SOCIAL_PATTERNS: {
    instagram: /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,50}\/?$/,
    facebook:  /^https:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.%-]{1,100}\/?$/,
    linkedin:  /^https:\/\/(www\.)?linkedin\.com\/(company|in|school)\/[a-zA-Z0-9_%-]{1,100}\/?$/,
    github:    /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]{1,100}\/?$/,
    whatsapp:  /^(\+\d{7,15}|https:\/\/(wa\.me|api\.whatsapp\.com\/send)\/.+)$/,
  },

  ALLOWED_DOC_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.csv'],
  ALLOWED_INV_TYPES: ['.csv', '.xlsx', '.xls', '.json', '.doc', '.docx', '.pdf', '.txt', '.ods', '.odt', '.tsv', '.xml'],
  MAX_FILE_SIZE_MB:  10,

  /** URL debe ser http(s) válida — usado por la conexión de inventario externo */
  URL_PATTERN: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
};

/* ─────────────────────────────────────────────
   ESTADO
───────────────────────────────────────────── */
const state = {
  name:         'Modelo sin nombre',
  company:      '',
  color:        '#3DBA65',
  tone:         ['Profesional'],
  voice:        ['Femenina'],
  lang:         'Español',
  tags:         [],
  restrictions: '',
  role:         'Vendedor',
  companyInfo:  {},
  docs:         [],

  /**
   * Inventario:
   *  own      → archivo propio subido directo al backend
   *  external → fuente externa (ej. Shopify, Google Sheets API, ERP) vía URL + API key
   */
  inventory: {
    own: {
      connected: false,
      name:      '',
      size:      0,
      uploading: false,
      progress:  0,
    },
    external: {
      connected: false,
      url:       '',
      key:       '',
      testing:   false,
    },
  },

  socials: {
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
   *   - Separadores de línea unicode (U+2028, U+2029)
   *   - Caracteres nulos embebidos
   */
  cleanForJson(str) {
    if (typeof str !== 'string') return '';
    return str
      // Normaliza a forma NFC: evita que letras con tilde/diéresis (ñ, á, ü…)
      // queden como combinaciones de caracteres (n + ˜) que rompan validaciones
      // o se vean mal en el backend.
      .normalize('NFC')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\u2028|\u2029/g, '')
      .replace(/\0/g, '');
  },

  truncate(str, maxLen) {
    if (typeof str !== 'string') return '';
    return Security.cleanForJson(str).slice(0, maxLen);
  },

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

  /** Valida una URL genérica http(s) — usada por inventario externo. */
  validateUrl(value) {
    if (!value) return false;
    return CONFIG.URL_PATTERN.test(value.trim());
  },

  /** Valida que un color sea un hex válido de 6 dígitos. */
  validateColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#3DBA65';
  },

  /**
   * Construye el payload seguro para el backend.
   *
   * Ejemplo de salida real (con inventario propio y externo conectados):
   * {
   *   "name": "Ana",
   *   "company": "Bomba Dulce",
   *   "color": "#3DBA65",
   *   "tone": ["Profesional", "Cercano"],
   *   "voice": ["Femenina"],
   *   "lang": "Español",
   *   "tags": ["ventas", "atencion-cliente"],
   *   "restrictions": "No ofrecer descuentos sin autorización.",
   *   "role": "Vendedor",
   *   "companyInfo": {
   *     "biz": "Tienda de golosinas y regalos temáticos",
   *     "does": "Vende bombas de dulces y arreglos personalizados",
   *     "vision": "Ser la marca líder en regalos dulces de Venezuela",
   *     "mission": "Sorprender con cada entrega",
   *     "values": "Creatividad, calidad, cercanía"
   *   },
   *   "socials": {
   *     "instagram": "https://instagram.com/bombadulce",
   *     "whatsapp": "+584121234567"
   *   },
   *   "inventory": {
   *     "own": {
   *       "name": "inventario_octubre.csv",
   *       "size": 24576
   *     },
   *     "external": {
   *       "url": "https://mitienda.myshopify.com/api",
   *       "key": "sk_live_xxxxxxxxxxxx"
   *     }
   *   },
   *   "isActive": true
   * }
   *
   * Nota: "inventory.own" e "inventory.external" solo aparecen cuando
   * state.inventory.own.connected / state.inventory.external.connected
   * son true. Si ninguno está conectado, "inventory" se envía como {}.
   */
  buildPayload() {
    const activeSocials = {};
    for (const [net, data] of Object.entries(state.socials)) {
      if (data.enabled && data.url) {
        activeSocials[net] = Security.sanitizeForJson(data.url, CONFIG.MAX_LENGTHS.socialUrl);
      }
    }

    const inventory = {};
    if (state.inventory.own.connected) {
      inventory.own = {
        name: Security.sanitizeForJson(state.inventory.own.name, 255),
        size: state.inventory.own.size,
      };
    }
    if (state.inventory.external.connected) {
      inventory.external = {
        url: Security.sanitizeForJson(state.inventory.external.url, CONFIG.MAX_LENGTHS.invUrl),
        key: Security.sanitizeForJson(state.inventory.external.key, CONFIG.MAX_LENGTHS.invKey),
      };
    }

    return {
      name:         Security.sanitizeForJson(state.name,         CONFIG.MAX_LENGTHS.modelName),
      company:      Security.sanitizeForJson(state.company,      CONFIG.MAX_LENGTHS.companyName),
      color:        Security.validateColor(state.color),
      tone:         state.tone.map(t  => Security.sanitizeForJson(t, 50)),
      voice:        state.voice.map(v => Security.sanitizeForJson(v, 50)),
      lang:         Security.sanitizeForJson(state.lang, 50),
      tags:         state.tags.map(t  => Security.sanitizeForJson(t, CONFIG.MAX_LENGTHS.tag)),
      restrictions: Security.sanitizeForJson(state.restrictions, CONFIG.MAX_LENGTHS.restrictions),
      role:         Security.sanitizeForJson(state.role, 80),
      companyInfo: {
        biz:     Security.sanitizeForJson(state.companyInfo.biz     || '', CONFIG.MAX_LENGTHS.companyBiz),
        does:    Security.sanitizeForJson(state.companyInfo.does    || '', CONFIG.MAX_LENGTHS.companyDoes),
        vision:  Security.sanitizeForJson(state.companyInfo.vision  || '', CONFIG.MAX_LENGTHS.companyVision),
        mission: Security.sanitizeForJson(state.companyInfo.mission || '', CONFIG.MAX_LENGTHS.companyMission),
        values:  Security.sanitizeForJson(state.companyInfo.values  || '', CONFIG.MAX_LENGTHS.companyValues),
      },
      socials:   activeSocials,
      inventory,
      isActive:  state.isActive,
    };
  },
};

/* ─────────────────────────────────────────────
   UPLOAD CLIENT
   Para multipart/form-data — usa XHR para poder
   trackear progreso de subida de archivos.

   Uso:
     UploadClient.post('/empresa/carga', formData)
     UploadClient.post('/empresa/carga', formData, (pct) => console.log(pct + '%'))
───────────────────────────────────────────── */
const UploadClient = (() => {

  /**
   * @param {string}   path        — ruta relativa al BASE_URL
   * @param {FormData} formData    — datos multipart
   * @param {Function} [onProgress] — callback(porcentaje: number)
   * @returns {Promise<any>}       — respuesta JSON del servidor
   */
  const post = (path, formData, onProgress = null) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${CONFIG.BASE_URL}${path}`);

      // Headers sin Content-Type: el browser lo pone solo con el boundary correcto
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
      // xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ raw: xhr.responseText });
          }
        } else {
          reject(new Error(`[UploadClient] HTTP ${xhr.status} en ${path}`));
        }
      };

      xhr.onerror   = () => reject(new Error('[UploadClient] Error de red'));
      xhr.ontimeout = () => reject(new Error('[UploadClient] Timeout'));
      xhr.timeout   = 60_000; // 60 s para archivos grandes

      xhr.send(formData);
    });
  };

  return { post };
})();

/* ─────────────────────────────────────────────
   API CLIENT
   Para endpoints JSON (GET / POST / PUT / DELETE).
   No manejes archivos desde acá; usá UploadClient para eso.

   Endpoints de empresa:
     GET    /empresa/search/<nombre_empresa>
     POST   /empresa/carga
     PUT    /empresa/update/<nombre_empresa>
     DELETE /empresa/delete/<nombre_empresa>

   Endpoints de inventario:
     GET    /inventario/inventory/<nombre_empresa> — solo el inventario, sin el resto del JSON
     POST   /inventario/propio          (multipart, ver UploadClient)
     POST   /inventario/externo/test    (JSON { url, key })
     POST   /inventario/externo         (JSON { url, key })
     DELETE /inventario/propio
     DELETE /inventario/externo

   Uso:
     ApiClient.searchEmpresa('Bomba Dulce')
     ApiClient.saveConfig(payload)
     ApiClient.updateEmpresa('Bomba Dulce', payload)
     ApiClient.deleteEmpresa('Bomba Dulce')
───────────────────────────────────────────── */
const ApiClient = (() => {

  const headers = () => ({
    // charset=utf-8 explícito: asegura que ñ, tildes y demás caracteres
    // especiales viajen bien y el backend los decodifique correctamente.
    'Content-Type': 'application/json; charset=utf-8',
    'ngrok-skip-browser-warning': 'true',
    // 'Authorization': `Bearer ${getToken()}`,
  });

  const request = async (method, path, body = null) => {
    const opts = { method, headers: headers() };
    if (body !== null) opts.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(`${CONFIG.BASE_URL}${path}`, opts);
    } catch (networkErr) {
      throw new Error(`[ApiClient] Sin conexión — ${method} ${path}`);
    }

    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch { /* noop */ }
      throw new Error(`[ApiClient] HTTP ${response.status}${detail ? ': ' + detail : ''} — ${method} ${path}`);
    }

    // Respuestas 204 No Content no tienen body
    if (response.status === 204) return null;

    return response.json();
  };

  return {
    get:    (path)       => request('GET',    path),
    post:   (path, body) => request('POST',   path, body),
    put:    (path, body) => request('PUT',    path, body),
    patch:  (path, body) => request('PATCH',  path, body),
    delete: (path)       => request('DELETE', path),

    /**
     * Atajo semántico: guarda la configuración del modelo (crea la empresa).
     * Equivale a ApiClient.post('/empresa/carga', data)
     */
    saveConfig: (data) => request('POST', '/empresa/carga', data),

    /**
     * Busca una empresa por nombre.
     * Equivale a ApiClient.get(`/empresa/search/${nombreEmpresa}`)
     */
    searchEmpresa: (nombreEmpresa) =>
      request('GET', `/empresa/search/${encodeURIComponent(nombreEmpresa)}`),

    /**
     * Actualiza la configuración de una empresa existente.
     * Equivale a ApiClient.put(`/empresa/update/${nombreEmpresa}`, data)
     */
    updateEmpresa: (nombreEmpresa, data) =>
      request('PUT', `/empresa/update/${encodeURIComponent(nombreEmpresa)}`, data),

    /**
     * Elimina una empresa por nombre.
     * Equivale a ApiClient.delete(`/empresa/delete/${nombreEmpresa}`)
     */
    deleteEmpresa: (nombreEmpresa) =>
      request('DELETE', `/empresa/delete/${encodeURIComponent(nombreEmpresa)}`),

    /**
     * Trae solo el inventario de una empresa (sin el resto del JSON del modelo).
     * Equivale a ApiClient.get(`/inventario/inventory/${nombreEmpresa}`)
     */
    getInventory: (nombreEmpresa) =>
      request('GET', `/inventario/inventory/${encodeURIComponent(nombreEmpresa)}`),

    /**
     * Prueba credenciales de una fuente de inventario externa ANTES de guardarla.
     * El backend debería responder 200 si logra autenticar/leer la fuente.
     */
    testExternalInventory: (url, key) =>
      request('POST', '/inventario/externo/test', { url, key }),

    /** Guarda la conexión de inventario externo ya validada. */
    connectExternalInventory: (url, key) =>
      request('POST', '/inventario/externo', { url, key }),

    /** Elimina la conexión de inventario externo. */
    disconnectExternalInventory: () =>
      request('DELETE', '/inventario/externo'),

    /** Elimina el inventario propio subido. */
    disconnectOwnInventory: () =>
      request('DELETE', '/inventario/propio'),
  };
})();

/* ─────────────────────────────────────────────
   DOM HELPERS — sin innerHTML con datos del usuario
───────────────────────────────────────────── */
function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if      (k === 'className')    el.className = v;
    else if (k === 'textContent')  el.textContent = v;
    else if (k === 'title')        el.title = v;
    else if (k === 'href')         el.href = v;
    else if (k === 'target')       el.target = v;
    else if (k === 'rel')          el.rel = v;
    else if (k === 'ariaLabel')    el.setAttribute('aria-label', v);
    else                           el.setAttribute(k, v);
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
───────────────────────────────────────────── */
const tagButtonMap = new Map(); // tag string → DOM element

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

  const removeBtn = createElement('button', { ariaLabel: `Eliminar tag ${tag}` });
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeTag(removeBtn, tag));

  const el = createElement('span', { className: 'tag' }, [removeBtn]);
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

    const safeName = Security.sanitizeForJson(file.name, 255);
    if (!safeName || state.docs.find(d => d.name === safeName)) return;

    state.docs.push({ name: safeName, size: file.size });
    renderDocItem(safeName);

    /* ── Ejemplo de subida real con UploadClient ──
    const fd = new FormData();
    fd.append('doc', file);
    UploadClient.post('/empresa/docs', fd, (pct) => {
      console.log(`Subiendo ${safeName}… ${pct}%`);
    }).then(res => {
      console.log('Doc subido:', res);
    }).catch(err => {
      console.error('Error subiendo doc:', err.message);
    });
    ── fin ejemplo ── */
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
   Dos modos, cada uno con conexión real y feedback visual:

     1) PROPIO — el usuario suelta/selecciona un .csv/.xlsx/.json
        y se sube directo al backend con barra de progreso.

     2) EXTERNO — el usuario ingresa URL + API key de su fuente
        (Shopify, Sheets, ERP, etc). Antes de guardar, se prueba
        la conexión contra el backend; solo si responde OK se
        marca como conectada.

   IDs de DOM esperados (agregalos a tu HTML si no existen):
     Propio:
       #ownInvDrop   → zona de drop / click
       #ownInvInput  → <input type="file"> oculto
       #ownInvName   → texto con el nombre del archivo / estado
       #ownInvBar    → <div> barra de progreso (opcional)
       #ownConnectBtn→ botón conectar/desconectar

     Externo:
       #extInvDrop     → contenedor del formulario externo
       #extInvUrlInput → <input> para la URL
       #extInvKeyInput → <input> para la API key
       #extInvName     → texto de estado ("✓ Conectado a…")
       #extConnectBtn  → botón conectar/desconectar
───────────────────────────────────────────── */

/** Aplica un estado visual simple a un botón de conexión. */
function setInvButtonState(btn, connected, labels) {
  btn.classList.toggle('connected', connected);
  btn.disabled    = false;
  btn.textContent = connected ? labels.connected : labels.disconnected;
}

/** Muestra/oculta y actualiza la barra de progreso de subida (si existe en el HTML). */
function setInvProgress(pct) {
  const bar = document.getElementById('ownInvBar');
  if (!bar) return;
  bar.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
  bar.style.width   = `${pct}%`;
}

/* ---------- INVENTARIO PROPIO (archivo) ---------- */

/** Dispara el selector de archivo — llamalo desde el click en la drop-zone. */
function triggerOwnInvSelect() {
  const input = document.getElementById('ownInvInput');
  if (input) input.click();
}

/** Handler del <input type="file"> o de un drop de archivo. Sube directo al backend. */
function handleInvFile(event, type) {
  const file = event.target?.files?.[0] ?? event; // acepta Event o File directo (drag&drop)
  if (!file) return;

  if (type !== 'own') return; // el tipo externo usa connectExternalInventory(), no archivo

  const check = Security.validateFile(file, CONFIG.ALLOWED_INV_TYPES);
  if (!check.ok) { alert(check.msg); if (event.target) event.target.value = ''; return; }

  const safeName = Security.sanitizeForJson(file.name, 255);
  uploadOwnInventory(file, safeName);
}

/** Sube el archivo de inventario propio con progreso real. */
async function uploadOwnInventory(file, safeName) {
  const nameEl = document.getElementById('ownInvName');
  const btn    = document.getElementById('ownConnectBtn');

  state.inventory.own.uploading = true;
  state.inventory.own.progress  = 0;
  if (nameEl) { nameEl.textContent = `Subiendo ${safeName}…`; nameEl.style.display = 'block'; }
  if (btn)    { btn.disabled = true; btn.textContent = 'Subiendo…'; }
  setInvProgress(1);

  try {
    const fd = new FormData();
    fd.append('inventory', file);

    const res = await UploadClient.post('/inventario/propio', fd, (pct) => {
      state.inventory.own.progress = pct;
      setInvProgress(pct);
    });

    state.inventory.own = {
      connected: true,
      name:      safeName,
      size:      file.size,
      uploading: false,
      progress:  100,
    };

    if (nameEl) nameEl.textContent = `✓ ${safeName}`;
    if (btn) setInvButtonState(btn, true, {
      connected:    '✓ Inventario conectado — quitar',
      disconnected: 'Conectar inventario',
    });
    setInvProgress(0);
    return res;
  } catch (err) {
    console.error('[ANA] Error subiendo inventario propio:', err.message);
    state.inventory.own.uploading = false;
    if (nameEl) nameEl.textContent = 'Error al subir el archivo. Probá de nuevo.';
    if (btn) setInvButtonState(btn, false, {
      connected:    '✓ Inventario conectado — quitar',
      disconnected: 'Conectar inventario',
    });
    setInvProgress(0);
  }
}

/** Quita la conexión de inventario propio (backend + estado + UI). */
async function disconnectOwnInventory() {
  const nameEl = document.getElementById('ownInvName');
  const btn    = document.getElementById('ownConnectBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Quitando…'; }

  try {
    if (state.inventory.own.connected) {
      await ApiClient.disconnectOwnInventory();
    }
  } catch (err) {
    console.error('[ANA] Error desconectando inventario propio:', err.message);
    // seguimos limpiando el estado local igual, para no dejar la UI trabada
  }

  state.inventory.own = { connected: false, name: '', size: 0, uploading: false, progress: 0 };
  if (nameEl) { nameEl.textContent = ''; nameEl.style.display = 'none'; }
  if (btn) setInvButtonState(btn, false, {
    connected:    '✓ Inventario conectado — quitar',
    disconnected: 'Conectar inventario',
  });
}

/* ---------- INVENTARIO EXTERNO (URL + API key) ---------- */

/**
 * Conecta una fuente externa de inventario. Prueba credenciales antes
 * de guardar — así el usuario sabe en un click si algo está mal, sin
 * tener que esperar al guardado general del modelo.
 */
async function connectExternalInventory() {
  const urlInput = document.getElementById('extInvUrlInput');
  const keyInput = document.getElementById('extInvKeyInput');
  const nameEl   = document.getElementById('extInvName');
  const btn      = document.getElementById('extConnectBtn');

  // Si ya está conectado, el botón actúa como "desconectar"
  if (state.inventory.external.connected) {
    return disconnectExternalInventory();
  }

  const url = Security.sanitizeForJson((urlInput?.value || '').trim(), CONFIG.MAX_LENGTHS.invUrl);
  const key = Security.sanitizeForJson((keyInput?.value || '').trim(), CONFIG.MAX_LENGTHS.invKey);

  if (!url || !Security.validateUrl(url)) {
    alert('Ingresá una URL válida (debe empezar con http:// o https://).');
    urlInput?.focus();
    return;
  }
  if (!key) {
    alert('Ingresá la API key de la fuente externa.');
    keyInput?.focus();
    return;
  }

  state.inventory.external.testing = true;
  if (btn)    { btn.disabled = true; btn.textContent = 'Probando conexión…'; }
  if (nameEl) { nameEl.textContent = 'Verificando credenciales…'; nameEl.style.display = 'block'; }

  try {
    // 1) Probar antes de guardar — evita conexiones "fantasma"
    await ApiClient.testExternalInventory(url, key);

    // 2) Si la prueba pasa, guardar la conexión
    await ApiClient.connectExternalInventory(url, key);

    state.inventory.external = { connected: true, url, key, testing: false };

    if (nameEl) nameEl.textContent = `✓ Conectado a ${new URL(url).hostname}`;
    if (btn) setInvButtonState(btn, true, {
      connected:    '✓ Fuente conectada — quitar',
      disconnected: 'Conectar fuente externa',
    });
    if (keyInput) keyInput.value = ''; // no dejamos la key visible en el input
  } catch (err) {
    console.error('[ANA] Error conectando inventario externo:', err.message);
    state.inventory.external.testing = false;
    if (nameEl) nameEl.textContent = 'No se pudo conectar. Revisá la URL y la API key.';
    if (btn) setInvButtonState(btn, false, {
      connected:    '✓ Fuente conectada — quitar',
      disconnected: 'Conectar fuente externa',
    });
  }
}

/** Quita la conexión de inventario externo (backend + estado + UI). */
async function disconnectExternalInventory() {
  const nameEl   = document.getElementById('extInvName');
  const btn      = document.getElementById('extConnectBtn');
  const urlInput = document.getElementById('extInvUrlInput');
  const keyInput = document.getElementById('extInvKeyInput');

  if (btn) { btn.disabled = true; btn.textContent = 'Quitando…'; }

  try {
    if (state.inventory.external.connected) {
      await ApiClient.disconnectExternalInventory();
    }
  } catch (err) {
    console.error('[ANA] Error desconectando inventario externo:', err.message);
  }

  state.inventory.external = { connected: false, url: '', key: '', testing: false };
  if (nameEl)   { nameEl.textContent = ''; nameEl.style.display = 'none'; }
  if (urlInput) urlInput.value = '';
  if (keyInput) keyInput.value = '';
  if (btn) setInvButtonState(btn, false, {
    connected:    '✓ Fuente conectada — quitar',
    disconnected: 'Conectar fuente externa',
  });
}

/**
 * Punto de entrada único para el botón de conexión — decide propio vs
 * externo y si toca conectar o desconectar, según el estado actual.
 */
function connectInv(type) {
  if (type === 'own') {
    return state.inventory.own.connected
      ? disconnectOwnInventory()
      : triggerOwnInvSelect(); // el submit real ocurre en handleInvFile al elegir el archivo
  }
  if (type === 'external') {
    return connectExternalInventory();
  }
}

/** Habilita drag & drop real (no solo visual) sobre la zona de inventario propio. */
function setupInventoryDragDrop() {
  const dropZones = [
    { id: 'ownInvDrop', type: 'own' },
    { id: 'extInvDrop', type: 'external' },
  ];

  dropZones.forEach(({ id, type }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (type !== 'own') return; // la fuente externa no acepta archivos soltados

      const file = e.dataTransfer?.files?.[0];
      if (file) handleInvFile(file, 'own');
    });
  });
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

  while (container.firstChild) container.removeChild(container.firstChild);

  if (!active.length) {
    const empty = createElement('span', { className: 'social-preview-empty' });
    empty.textContent = 'Ninguna red habilitada aún.';
    container.appendChild(empty);
    return;
  }

  for (const [net, data] of active) {
    const safeUrl = Security.sanitizeForJson(data.url, CONFIG.MAX_LENGTHS.socialUrl);
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
   Crea la empresa vía ApiClient.saveConfig() → POST /empresa/carga
   Si ya existe, usá ApiClient.updateEmpresa(nombre, payload) → PUT /empresa/update/<nombre_empresa>
───────────────────────────────────────────── */
async function saveConfig() {
  const btn = document.querySelector('.save-btn');

  // Validar redes habilitadas antes de enviar
  for (const [net, data] of Object.entries(state.socials)) {
    if (data.enabled && !Security.validateSocialUrl(net, data.url)) {
      alert(`La URL de ${net} no es válida. Corregila antes de guardar.`);
      return;
    }
  }

  // Volcar DOM → estado con sanitización
  state.name = Security.sanitizeForJson(
    document.getElementById('modelName').value.trim() || 'Modelo sin nombre',
    CONFIG.MAX_LENGTHS.modelName
  );
  state.lang = Security.sanitizeForJson(
    document.getElementById('modelLang').value,
    50
  );
  state.restrictions = Security.sanitizeForJson(
    document.getElementById('restrictions').value,
    CONFIG.MAX_LENGTHS.restrictions
  );
  state.companyInfo = {
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
    setTimeout(() => {
      btn.textContent = 'Guardar modelo';
      btn.disabled    = false;
    }, 3000);
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

  // Input de archivo oculto para inventario propio (click en la drop-zone lo dispara)
  const ownInvInput = document.getElementById('ownInvInput');
  if (ownInvInput) {
    ownInvInput.addEventListener('change', e => handleInvFile(e, 'own'));
  }
  const ownInvDrop = document.getElementById('ownInvDrop');
  if (ownInvDrop) {
    ownInvDrop.addEventListener('click', () => {
      if (!state.inventory.own.connected) triggerOwnInvSelect();
    });
  }

  // Permite conectar la fuente externa con Enter desde cualquiera de los dos campos
  ['extInvUrlInput', 'extInvKeyInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); connectExternalInventory(); }
    });
  });

  setupInventoryDragDrop();
  renderOrb();
});
