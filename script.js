  /* ── live orb label ── */
  const nameInput = document.getElementById('modelName');
  nameInput.addEventListener('input', updateOrbMeta);
  function updateOrbMeta() {
    const name = nameInput.value.trim() || 'Modelo sin nombre';
    document.getElementById('orbLabel').textContent = name;
    const company = document.getElementById('companyName').value.trim();
    if (company) document.getElementById('orbStatus').textContent = `Activo · ${company}`;
    else document.getElementById('orbStatus').textContent = 'En espera de configuración';
  }

  /* ── orb click ── */
  let orbActive = false;
  function activateOrb() {
    const orb = document.getElementById('mainOrb');
    orbActive = !orbActive;
    if (orbActive) {
      orb.style.animation = 'pulse .6s ease, float 5s ease-in-out infinite';
      document.getElementById('orbStatus').textContent = '● Modelo activo';
      orb.style.filter = 'brightness(1.1)';
    } else {
      orb.style.filter = '';
      updateOrbMeta();
    }
  }

  /* ── color sync ── */
  function syncColor(input) {
    document.getElementById('modelColorHex').value = input.value;
    document.getElementById('mainOrb').style.background =
      `radial-gradient(circle at 38% 35%, rgba(255,255,255,.7) 0%, ${input.value}cc 45%, ${input.value} 80%, ${input.value}dd 100%)`;
  }
  function syncHex(input) {
    const val = input.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      document.getElementById('modelColor').value = val;
      document.getElementById('mainOrb').style.background =
        `radial-gradient(circle at 38% 35%, rgba(255,255,255,.7) 0%, ${val}cc 45%, ${val} 80%, ${val}dd 100%)`;
    }
  }

  /* ── chips (single-select per group) ── */
  function toggleChip(el, group) {
    const grp = el.closest('.chip-group');
    grp.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  /* ── role cards ── */
  function selectRole(el) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  /* ── tag input ── */
  function handleTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/,$/, '');
      if (!val) return;
      addTag(val);
      e.target.value = '';
    } else if (e.key === 'Backspace' && !e.target.value) {
      const tags = document.querySelectorAll('#tagContainer .tag');
      if (tags.length) tags[tags.length - 1].remove();
    }
  }
  function addTag(text) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${text}<button onclick="this.parentElement.remove()" title="Eliminar">×</button>`;
    document.getElementById('tagContainer').insertBefore(tag, document.getElementById('tagInput'));
  }
  function focusTagInput() { document.getElementById('tagInput').focus(); }

  /* ── document upload ── */
  function handleDocs(e) {
    const list = document.getElementById('docList');
    Array.from(e.target.files).forEach(file => {
      const item = document.createElement('div');
      item.className = 'doc-item';
      item.innerHTML = `<span>📄 ${file.name}</span><button class="doc-remove" title="Quitar" onclick="this.parentElement.remove()">×</button>`;
      list.appendChild(item);
      item.style.animation = 'fadeUp .3s ease both';
    });
  }

  /* ── inventory file ── */
  function handleInvFile(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    const el = document.getElementById(type === 'own' ? 'ownInvName' : 'extInvName');
    el.style.display = 'block';
    el.textContent = `✓ ${file.name}`;
  }

  /* ── connect inventory ── */
  function connectInv(type) {
    const btn = document.getElementById(type === 'own' ? 'ownConnectBtn' : 'extConnectBtn');
    btn.textContent = '✓ Conectado';
    btn.classList.add('connected');
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; btn.classList.remove('connected'); btn.textContent = type === 'own' ? 'Conectar inventario' : 'Conectar fuente externa'; }, 4000);
  }

  /* ── save ── */
  function saveConfig() {
    const name = document.getElementById('modelName').value.trim() || 'Modelo';
    const btn = document.querySelector('.save-btn');
    btn.textContent = `✓ ${name} guardado`;
    btn.style.background = 'var(--green-3)';
    setTimeout(() => { btn.textContent = 'Guardar modelo'; btn.style.background = ''; }, 3000);
  }

  /* ── drag-over visual on inv drops ── */
  ['ownInvDrop','extInvDrop'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', () => el.classList.remove('drag-over'));
  });