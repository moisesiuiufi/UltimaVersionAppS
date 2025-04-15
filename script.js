document.addEventListener('DOMContentLoaded', () => {
    let MASTER_PASSWORD = '';
    let CURRENT_USER = '';

  // variables la cual son llamadas al DOM

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
  
      if (!inputEmail || !inputPassword) {
        showToast("Ingresa tu correo y contraseña", 'error');
        return;
      }
    
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inputEmail, password: inputPassword })
        });
        const data = await res.json();
  
        if (res.ok) {
          MASTER_PASSWORD = inputPassword;
          CURRENT_USER = data.username;
          sessionStorage.setItem('masterPassword', MASTER_PASSWORD);
          sessionStorage.setItem('currentUser', CURRENT_USER);
          loginSuccess();
          moverFooterAlGestor();
        } else {
          showToast(data.message || 'Error al iniciar sesión', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast("Error de conexión con el servidor", 'error');
      }
    });
    
  //  funcion sesion iniciada con exito en investigacion  tambien con funcion visual loginSuccess
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
  
      moverFooterAlGestor();
      renderPasswords();
      resetInactivityTimer();
    }
  // SECCION solo debe mostrarse cuando el usuario decide agregar una nueva contraseña.
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
  
      try {
        const res = await fetch('/api/passwords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: CURRENT_USER, masterPassword: MASTER_PASSWORD, site, user: username, pass: password })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Contraseña guardada correctamente');
          newPasswordForm.reset();
          newPasswordForm.style.display = 'none';
          renderPasswords();
        } else {
          showToast(data.message || 'Error al guardar contraseña', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast("Error al guardar", 'error');
      }
    });
  // Nueva funcion reiterar contraseñas 
  async function renderPasswords() {
    passwordsList.innerHTML = '';
    try {
      const res = await fetch(`/api/passwords?username=${CURRENT_USER}`);
      const data = await res.json();
  
      if (!res.ok) {
        showToast(data.message || "Error al obtener contraseñas", 'error');
        return;
      }
  
      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        let decrypted;
        try {
          decrypted = await decryptData(entry, MASTER_PASSWORD);
        } catch (err) {
          console.warn(`❌ No se pudo descifrar la entrada #${i}:`, err.message);
          continue; // Salta esta entrada si da error
        }
  
        const div = document.createElement('div');
        div.classList.add('entry');
        div.innerHTML = `
          <strong>${decrypted.site}</strong><br>
          Usuario: ${decrypted.username}
          <button class="copy-btn" data-type="username" data-value="${decrypted.username}">📋</button><br>
          Contraseña: ${decrypted.password}
          <button class="copy-btn" data-type="password" data-value="${decrypted.password}">📋</button><br>
          <button class="delete-btn" data-index="${i}">Eliminar</button>
        `;
        passwordsList.appendChild(div);
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
    } catch (err) {
      console.error(err);
      showToast("Error al obtener contraseñas", "error");
    }
  }
  
  //  Para buscar contraseñas en el gestor

  const searchInput = document.getElementById('search-passwords');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    const entries = document.querySelectorAll('#passwords-list .entry');
  
    entries.forEach(entry => {
      const text = entry.textContent.toLowerCase();
      entry.style.display = text.includes(query) ? '' : 'none';
    });
  });
  

  // funcion de eliminador de contraseñas

    async function deletePassword(index) {
      if (!confirm('¿Estás seguro de eliminar esta contraseña?')) return;
  
      try {
        const res = await fetch(`/api/passwords/${index}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: CURRENT_USER, masterPassword: MASTER_PASSWORD })
        });
        const data = await res.json();
        if (res.ok) {
          renderPasswords();
          showToast("Contraseña eliminada");
        } else {
          showToast(data.message || 'Error al eliminar', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar contraseña", "error");
      }
    }

    // Esto es incriptado de claver aun esta en INVESTIGACION DE FUNCIONAMIENTO 

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
// En investigacion de funcionamiento correcto 

      changeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = currentInput.value;
        const nueva = newInput.value;
      
        if (current !== MASTER_PASSWORD) {
          return showToast('La contraseña actual es incorrecta', 'error');
        }
      
        if (nueva === current) {
          return showToast('La nueva contraseña debe ser diferente', 'error');
        }
      
        if (nueva.length < 8) {
          return showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error');
        }
      
        try {
          // Solicita al servidor todas las contraseñas cifradas del usuario
          const res = await fetch('/api/passwords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: CURRENT_USER })
          });
      
          const data = await res.json();
          const encryptedPasswords = data.passwords || [];
      
          // Descifra localmente con la contraseña actual
          const descifradas = [];
          for (const item of encryptedPasswords) {
            descifradas.push(await decryptData(item, current));
          }
      
          // Vuelve a cifrar con la nueva contraseña
          const nuevasCifradas = [];
          for (const item of descifradas) {
            nuevasCifradas.push(await encryptData(item, nueva));
          }
      
          // Enviar contraseñas cifradas con nueva contraseña al backend
          const updateRes = await fetch('/api/change-master-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: CURRENT_USER,
              newPassword: nueva,
              encryptedPasswords: nuevasCifradas
            })
          });
      
          const updateData = await updateRes.json();
      
          if (updateRes.ok) {
            MASTER_PASSWORD = nueva;
            sessionStorage.setItem('masterPassword', nueva);
            showToast('Tu contraseña maestra se ha actualizado correctamente');
            changeForm.reset();
          } else {
            showToast(updateData.message || 'Error al actualizar la contraseña', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al actualizar la contraseña', 'error');
        }
      });
      
      // el nuevo código actualizado para trabajar con backend EN INVESTIGACION 

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
      
        try {
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
          });
      
          const data = await res.json();
      
          if (res.ok) {
            cerrarModal('modal-registro');
            showToast('Usuario registrado correctamente');
          } else {
            showToast(data.message || 'Error al registrar usuario', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al conectar con el servidor', 'error');
        }
      });
      

      // FUNCION PARA ENVIO DE CORREO ELECTRONICO 

      
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

// FUNCION DE TOGGLE VISUAL 
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
    sessionStorage.removeItem('currentUser'); // se encuetra en investigacion de funcionamineto 
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


   // ESTE APÁRTADO CONTIENE TODO LO VISUAL DEL GESTOR DE CONTRASEÑA MAS ADELANTE ES ARCHIVO SEPARADO 

  // Funcion por inactividad se cierra login es el avisa antes de serrarce

  let warningTimeout;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimeout);
        clearTimeout(warningTimeout);
        
        warningTimeout = setTimeout(() => {
          showToast("¿Sigues ahí? Cierre en 30s...", "error");
        }, 4.5 * 60 * 1000); // 4.5 minutos
      
        inactivityTimeout = setTimeout(() => {
          logoutBtn.click();
          showToast("Sesión cerrada por inactividad", 'error');
        }, 5 * 60 * 1000);
      }

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

  // funcion restaurar footer
  function restaurarFooter() {
    const footer = document.getElementById('footer');
    const body = document.body;
  
    if (footer) {
      body.appendChild(footer);
    }
  }

  // Fondo animado minimalista y liviano
const canvas = document.getElementById('universe');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Configuración de partículas
const particles = [];
const numParticles = 80; // Mucho menos = más liviano

function createParticle() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.2 + 0.3,
    speedX: (Math.random() - 0.5) * 0.2,
    speedY: (Math.random() - 0.5) * 0.2,
    opacity: Math.random() * 0.5 + 0.2
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

    // Movimiento suave
    p.x += p.speedX;
    p.y += p.speedY;

    // Reposicionar si sale de la pantalla
    if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
      Object.assign(p, createParticle());
    }
  }

  requestAnimationFrame(animate);
}

animate();


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

  // funcion madre para cerrar activida 
  
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

  if (sessionStorage.getItem('masterPassword') && sessionStorage.getItem('currentUser')) {
    MASTER_PASSWORD = sessionStorage.getItem('masterPassword');
    CURRENT_USER = sessionStorage.getItem('currentUser');
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

  });