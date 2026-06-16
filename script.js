/**
 * Configuración de la API y Estado de la Aplicación
 */
const CONFIG = {
  // URL actualizada para el túnel de Ngrok
  BACKEND_URL: 'https://3f11-190-26-35-16.ngrok-free.app/api', 
};

const state = {
  name: 'Modelo sin nombre',
  company: '',
  color: '#3498db',
  tags: [],
  isActive: false
};

const ApiClient = {
  async saveConfig(data) {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Error en el servidor');
      return await response.json();
    } catch (error) {
      console.error('Fallo en la conexión:', error);
      throw error;
    }
  },

  // Método adicional para probar la carga de empresa que mencionaste
  async loadEmpresa(empresaData) {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL.replace('/api', '')}/load_empresa/cargar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empresaData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error al cargar empresa:', error);
    }
  }
};

/**
 * Lógica de UI y Sincronización
 */
const UI = {
  elements: {
    orb: document.getElementById('mainOrb'),
    label: document.getElementById('orbLabel'),
    status: document.getElementById('orbStatus'),
    nameInput: document.getElementById('modelName'),
    companyInput: document.getElementById('companyName'),
    colorInput: document.getElementById('modelColor'),
    tagContainer: document.getElementById('tagContainer'),
    saveBtn: document.querySelector('.save-btn')
  },

  render() {
    this.elements.label.textContent = state.name;
    this.elements.status.textContent = state.isActive ? '● Modelo activo' : 
                                      (state.company ? `Activo · ${state.company}` : 'En espera de configuración');
    
    // Sincronizar el orbe
    this.elements.orb.style.background = `radial-gradient(circle at 38% 35%, rgba(255,255,255,.7) 0%, ${state.color}cc 45%, ${state.color} 80%, ${state.color}dd 100%)`;
  },

  init() {
    this.elements.nameInput.addEventListener('input', (e) => {
      state.name = e.target.value.trim() || 'Modelo sin nombre';
      this.render();
    });

    this.elements.companyInput.addEventListener('input', (e) => {
      state.company = e.target.value.trim();
      this.render();
    });

    this.elements.colorInput.addEventListener('input', (e) => {
      state.color = e.target.value;
      this.render();
    });

    this.elements.tagContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-tag')) {
        e.target.parentElement.remove();
      }
    });

    this.elements.saveBtn.addEventListener('click', async () => {
      this.elements.saveBtn.textContent = 'Guardando...';
      try {
        await ApiClient.saveConfig(state);
        this.elements.saveBtn.textContent = `✓ ${state.name} guardado`;
        setTimeout(() => { this.elements.saveBtn.textContent = 'Guardar modelo'; }, 3000);
      } catch {
        this.elements.saveBtn.textContent = 'Error al guardar';
      }
    });
  }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => UI.init());