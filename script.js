document.addEventListener('DOMContentLoaded', () => {
  let MASTER_PASSWORD = '';
  let CURRENT_USER = '';

  const loginForm = document.getElementById('login-form');
  const loginSection = document.getElementById('login-section');
  const passwordsSection = document.getElementById('passwords-section');
  const masterPasswordInput = document.getElementById('master-password');
  const logoutBtn = document.getElementById('logout-btn');
  const newPasswordForm = document.getElementById('new-password-form');
  const addPasswordBtn = document.getElementById('add-password-btn');
  const passwordsList = document.getElementById('passwords-list');
  const changeForm = document.getElementById('change-master-form');
  const currentInput = document.getElementById('current-master');
  const newInput = document.getElementById('new-master');
  logoutBtn.style.display = 'none';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEmail = document.getElementById('login-email').value.trim();
    const inputPassword = masterPasswordInput.value;
  
    const users = JSON.parse(localStorage.getItem('users')) || {};
    const userEntry = Object.entries(users).find(([, data]) => data.email === inputEmail);
  
    if (!inputEmail || !inputPassword) {
      showToast("Ingresa tu correo y contraseña", 'error');
      return;
    }
  
    if (!userEntry) {
      showToast("Correo no registrado", 'error');
      return;
    }
  
    const [username, userData] = userEntry;
  
    try {
      const decrypted = await decryptData(userData.password, inputPassword);
      if (decrypted.password !== inputPassword) {
        showToast("Contraseña incorrecta", 'error');
        return;
      }
  
      MASTER_PASSWORD = inputPassword;
      CURRENT_USER = username;
      sessionStorage.setItem('masterPassword', MASTER_PASSWORD);
      localStorage.setItem('currentUser', CURRENT_USER);
      loginSuccess();               // muestra la sección del gestor
      moverFooterAlGestor();        // mueve el footer dentro del gestor
  
    } catch (err) {
      console.error(err);
      showToast("Error al verificar la contraseña", 'error');
    }
  });
  
  

  function loginSuccess() {
    loginSection.style.display = 'none';
    passwordsSection.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    changeForm.style.display = 'block';

    const toast = document.getElementById('toastWelcome');
    if (toast) {
      toast.textContent = `Bienvenido, ${CURRENT_USER} 👋`;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.style.display = 'none', 400);
      }, 3000);
      toast.style.display = 'flex';
    }
    document.getElementById('login-section').classList.add('hidden');
  document.getElementById('passwords-section').classList.remove('hidden');

  // Aquí movemos el footer después de mostrar la sección
  moverFooterAlGestor();

    renderPasswords();
    resetInactivityTimer();
  }

  addPasswordBtn.addEventListener('click', () => {
    newPasswordForm.style.display = 'block';
  });

  newPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const site = document.getElementById('site').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!site || !username || !password) return showToast("Todos los campos son obligatorios", 'error');
    if (password.length < 6) return showToast("La contraseña debe tener al menos 6 caracteres", 'error');

    const newEntry = { site, username, password };
    const encrypted = await encryptData(newEntry, MASTER_PASSWORD);
    const key = `passwords_${CURRENT_USER}`;
    const stored = JSON.parse(localStorage.getItem(key)) || [];
    stored.push(encrypted);
    localStorage.setItem(key, JSON.stringify(stored));

    newPasswordForm.reset();
    newPasswordForm.style.display = 'none';
    renderPasswords();
    showToast("Contraseña guardada correctamente");
  });

  async function renderPasswords() {
    passwordsList.innerHTML = '';
    const key = `passwords_${CURRENT_USER}`;
    const stored = JSON.parse(localStorage.getItem(key)) || [];

    for (let index = 0; index < stored.length; index++) {
      try {
        const decrypted = await decryptData(stored[index], MASTER_PASSWORD);
        const div = document.createElement('div');
        div.classList.add('entry');
        div.innerHTML = `
          <strong>${decrypted.site}</strong><br>
          Usuario: ${decrypted.username}
          <button class="copy-btn" data-type="username" data-value="${decrypted.username}">📋</button><br>
          Contraseña: ${decrypted.password}
          <button class="copy-btn" data-type="password" data-value="${decrypted.password}">📋</button><br>
          <button class="delete-btn" data-index="${index}">Eliminar</button>
        `;
        passwordsList.appendChild(div);
      } catch (e) {
        console.error('Error al descifrar entrada', e);
      }
    }

    document.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => deletePassword(parseInt(btn.dataset.index)))
    );

    document.querySelectorAll('.copy-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          showToast(`${btn.dataset.type === 'username' ? 'Usuario' : 'Contraseña'} copiado al portapapeles`);
        });
      })
    );
  }

  const searchInput = document.getElementById('search-passwords');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  const entries = document.querySelectorAll('#passwords-list .entry');

  entries.forEach(entry => {
    const text = entry.textContent.toLowerCase();
    entry.style.display = text.includes(query) ? '' : 'none';
  });
});


  function deletePassword(index) {
    const key = `passwords_${CURRENT_USER}`;
    const stored = JSON.parse(localStorage.getItem(key)) || [];
    if (confirm('¿Estás seguro de que deseas eliminar esta contraseña?')) {
      stored.splice(index, 1);
      localStorage.setItem(key, JSON.stringify(stored));
      renderPasswords();
      showToast("Contraseña eliminada");
    }
  }

  async function encryptData(data, password) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { iv: Array.from(iv), salt: Array.from(salt), ciphertext: Array.from(new Uint8Array(ciphertext)) };
  }

  async function decryptData(encrypted, password) {
    const iv = new Uint8Array(encrypted.iv);
    const salt = new Uint8Array(encrypted.salt);
    const ciphertext = new Uint8Array(encrypted.ciphertext);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  changeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = currentInput.value;
    const nueva = newInput.value;

    if (current !== MASTER_PASSWORD) return showToast('La contraseña actual es incorrecta', 'error');
    if (nueva === current) return showToast('La nueva contraseña debe ser diferente', 'error');
    if (nueva.length < 8) return showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error');

    const key = `passwords_${CURRENT_USER}`;
    const stored = JSON.parse(localStorage.getItem(key)) || [];
    const descifradas = [];

    try {
      for (const item of stored) {
        descifradas.push(await decryptData(item, current));
      }
    } catch (err) {
      return showToast('Error al descifrar datos, verifica tu contraseña.', 'error');
    }

    const nuevasCifradas = [];
    for (const item of descifradas) {
      nuevasCifradas.push(await encryptData(item, nueva));
    }

    localStorage.setItem(key, JSON.stringify(nuevasCifradas));

    const users = JSON.parse(localStorage.getItem('users')) || {};
    const decrypted = await decryptData(users[CURRENT_USER].password, current);
    users[CURRENT_USER] = { password: await encryptData({ password: nueva, hint: decrypted.hint }, nueva) };
    localStorage.setItem('users', JSON.stringify(users));

    MASTER_PASSWORD = nueva;
    sessionStorage.setItem('masterPassword', nueva);
    showToast('Tu contraseña maestra se ha actualizado correctamente');
    changeForm.reset();
  });

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('registre-password-conf').value;
  
    if (!username || !email || !password || !confirm) {
      showToast('Rellena todos los campos', 'error');
      return;
    }
  
    if (password !== confirm) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }
  
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
  
    const users = JSON.parse(localStorage.getItem('users')) || {};
  
    if (Object.values(users).some(user => user.email === email)) {
      showToast('Ese correo ya está registrado', 'error');
      return;
    }
  
    if (users[username]) {
      showToast('Ese nombre de usuario ya existe', 'error');
      return;
    }
  
    const encrypted = await encryptData({ password }, password);
    users[username] = {
      email,
      password: encrypted
    };
  
    localStorage.setItem('users', JSON.stringify(users));
    cerrarModal('modal-registro');
    showToast('Usuario registrado correctamente');
  });
  
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.toLowerCase());
  }
  
  

  document.getElementById('form-recuperar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const email = document.getElementById('recovery-email').value.trim();
  
    if (!email) {
      showToast("Por favor ingresa tu correo electrónico", "error");
      return;
    }
  
    try {
      const res = await fetch('/api/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
  
      const data = await res.json();
  
      if (res.ok) {
        showToast("Te hemos enviado un correo con instrucciones para recuperar tu contraseña");
        cerrarModal('modal-recuperar');
      } else {
        showToast(data.message || "No se encontró el correo en nuestros registros", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al conectar con el servidor", "error");
    }
  });
  
  

  logoutBtn.addEventListener('click', () => {
    loginSection.style.display = 'block';
    passwordsSection.style.display = 'none';
    newPasswordForm.style.display = 'none';
    logoutBtn.style.display = 'none';
    changeForm.style.display = 'none';
    masterPasswordInput.value = '';
    masterPasswordInput.placeholder = 'Contraseña maestra';
    masterPasswordInput.style.border = '1px solid transparent';
    sessionStorage.removeItem('masterPassword');
    localStorage.removeItem('currentUser');
    MASTER_PASSWORD = '';
    CURRENT_USER = '';
  });

  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? '👁️' : '🙈';
    });
  });

  let inactivityTimeout;
  function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      logoutBtn.click();
      showToast("Sesión cerrada por inactividad", 'error');
    }, 5 * 60 * 1000);
  }

  ['click', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer);
  });

  if (sessionStorage.getItem('masterPassword') && localStorage.getItem('currentUser')) {
    MASTER_PASSWORD = sessionStorage.getItem('masterPassword');
    CURRENT_USER = localStorage.getItem('currentUser');
    loginSuccess();
  }

  function showToast(mensaje, tipo = 'normal') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      background: ${tipo === 'error' ? '#ff4e4e' : 'var(--accent)'};
      color: white;
      padding: 0.8rem 1.5rem;
      border-radius: 10px;
      font-weight: bold;
      z-index: 9999;
      box-shadow: 0 5px 20px rgba(48, 49, 58, 0.3);
      opacity: 0;
      animation: fadeinout 3s ease forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeinout {
      0% { opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
    .toast {
      opacity: 0;
      animation: fadeinout 3s ease forwards;
    }
    .shake {
      animation: shake 0.3s;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);

// MODALES (hacerlas globales explícitamente)
window.mostrarModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  modal.style.display = 'flex';
  content.style.animation = 'fadeIn 0.3s ease forwards';
};

window.cerrarModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  content.style.animation = 'fadeOut 0.3s ease forwards';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
};

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) e.stopPropagation();
  });
});

document.getElementById('register-btn')?.addEventListener('click', () => {
  mostrarModal('modal-registro');
});
document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
  mostrarModal('modal-recuperar');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(modal => {
      if (modal.style.display === 'flex') cerrarModal(modal.id);
    });
  }
});


const canvas = document.getElementById('universe');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];
const numParticles = 300; // 🌌 Aumentá o bajá si querés más/menos partículas

// Objeto del mouse para interacción
const mouse = {
  x: null,
  y: null,
  radius: 120
};

// Crear partícula
function createParticle() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * (canvas.width / 2);
  const x = canvas.width / 2 + Math.cos(angle) * radius;
  const y = canvas.height / 2 + Math.sin(angle) * radius;

  return {
    x,
    y,
    size: Math.random() * 1.5 + 0.5,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.6 + 0.4
  };
}

// Inicializar partículas
for (let i = 0; i < numParticles; i++) {
  particles.push(createParticle());
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
    ctx.fill();

    // Movimiento
    p.x += p.speedX;
    p.y += p.speedY;

    // Reubicar partícula si se sale de la pantalla
    const dx = p.x - canvas.width / 2;
    const dy = p.y - canvas.height / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > canvas.width) {
      const newParticle = createParticle();
      p.x = newParticle.x;
      p.y = newParticle.y;
      p.speedX = newParticle.speedX;
      p.speedY = newParticle.speedY;
      p.opacity = newParticle.opacity;
    }
  }

  // Dibujar líneas entre partículas cercanas
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i];
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, 'rgba(138, 43, 226, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 191, 255, 0.3)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(animate);
}

animate();

// Interacción con el mouse
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => {
  mouse.x = null;
  mouse.y = null;
});

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
// funcion de footer solo se muestra dentro de gestor
function moverFooterAlGestor() {
  const footer = document.getElementById('footer');
  const gestorSection = document.getElementById('passwords-section');

  if (footer && gestorSection) {
    gestorSection.appendChild(footer);
    footer.style.marginTop = '2rem';
    footer.style.paddingBottom = '1rem';
  }
  else {
    console.warn("No se encontró el footer o la sección del gestor");
  }
}

function restaurarFooter() {
  const footer = document.getElementById('footer');
  const body = document.body;

  if (footer) {
    body.appendChild(footer);
  }
}



    });