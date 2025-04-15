require('dotenv').config();
console.log('USUARIO:', process.env.EMAIL_USER);
console.log('CONTRASEÑA:', process.env.EMAIL_PASS ? '✅ OK' : '❌ VACÍA');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { encryptData, decryptData } = require('./crypto-utils');

const app = express();
const PORT = process.env.PORT || 3000;


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'barbozamendozamoises@gmail.com',
    pass: 'axuortjsucbkjjmg'
  }
});


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PASSWORDS_FILE = path.join(__dirname, 'data', 'passwords.json');

// Helpers
function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error(`❌ Error leyendo el archivo ${file}:`, err.message);
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// REGISTRO
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  const users = readJSON(USERS_FILE);
  if (users[username] || Object.values(users).some(u => u.email === email)) {
    return res.status(409).json({ message: 'Usuario o correo ya registrado' });
  }

  const encryptedPassword = encryptData({ password }, password);
  users[username] = { email, password: encryptedPassword };
  writeJSON(USERS_FILE, users);

  console.log(`✅ Usuario registrado: ${username}`);
  res.status(200).json({ message: 'Usuario registrado correctamente' });
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const entry = Object.entries(users).find(([, data]) => data.email === email);

  if (!entry) {
    return res.status(404).json({ message: 'Correo no encontrado' });
  }

  const [username, userData] = entry;

  try {
    const decrypted = decryptData(userData.password, password);
    if (decrypted.password !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    return res.status(200).json({ username });
  } catch (err) {
    return res.status(401).json({ message: 'Contraseña incorrecta' });
  }
});

// GUARDAR CONTRASEÑA
app.post('/api/passwords', (req, res) => {
  const { username, site, user, pass, masterPassword } = req.body;

  if (!username || !site || !user || !pass || !masterPassword) {
    return res.status(400).json({ message: 'Faltan datos para guardar la contraseña' });
  }

  try {
    const passwords = readJSON(PASSWORDS_FILE);
    passwords[username] = passwords[username] || [];

    // Cifrar la entrada usando la contraseña maestra como clave
    const encryptedEntry = encryptData({ site, username: user, password: pass }, masterPassword);
    passwords[username].push(encryptedEntry);

    writeJSON(PASSWORDS_FILE, passwords);
    res.status(200).json({ message: 'Contraseña guardada correctamente' });
  } catch (err) {
    console.error('❌ Error al guardar la contraseña:', err.message);
    res.status(500).json({ message: 'Error del servidor al guardar' });
  }
});


// OBTENER CONTRASEÑAS
app.get('/api/passwords', (req, res) => {
  const { username } = req.query;
  const passwords = readJSON(PASSWORDS_FILE);
  res.status(200).json(passwords[username] || []);
});

// ELIMINAR CONTRASEÑA
app.delete('/api/passwords/:index', (req, res) => {
  const { username } = req.body;
  const { index } = req.params;

  const passwords = readJSON(PASSWORDS_FILE);
  if (!passwords[username] || !passwords[username][index]) {
    return res.status(404).json({ message: 'Contraseña no encontrada' });
  }

  passwords[username].splice(index, 1);
  writeJSON(PASSWORDS_FILE, passwords);
  res.status(200).json({ message: 'Contraseña eliminada' });
});

// CAMBIAR CONTRASEÑA MAESTRA
app.post('/api/change-master-password', (req, res) => {
  const { username, newPassword, encryptedPasswords } = req.body;
  if (!username || !newPassword || !Array.isArray(encryptedPasswords)) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }

  const users = readJSON(USERS_FILE);
  const passwords = readJSON(PASSWORDS_FILE);

  if (!users[username]) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  const newEncrypted = encryptData({ password: newPassword }, newPassword);
  users[username].password = newEncrypted;
  passwords[username] = encryptedPasswords;

  writeJSON(USERS_FILE, users);
  writeJSON(PASSWORDS_FILE, passwords);

  res.status(200).json({ message: 'Contraseña maestra actualizada' });
});

// RECUPERACIÓN
app.post('/api/recuperar', (req, res) => {
  const { email } = req.body;
  const users = readJSON(USERS_FILE);

  const userEntry = Object.entries(users).find(([, data]) => data.email === email);

  if (!userEntry) {
    return res.status(404).json({ message: 'Correo no registrado' });
  }

  const [username] = userEntry;

  // Aquí se simula el link de recuperación (en producción deberías tener un token o link real)
  const recoveryLink = `http://localhost:3000/recovery.html?user=${encodeURIComponent(username)}`;

  const mailOptions = {
    from: `"Gestor de Contraseñas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Recuperación de contraseña',
    html: `
      <h2>Hola, ${username}</h2>
      <p>Hemos recibido una solicitud para recuperar tu contraseña maestra.</p>
      <p><a href="${recoveryLink}" style="padding:10px 20px;background:#4f46e5;color:#fff;border-radius:5px;text-decoration:none;">Recuperar contraseña</a></p>
      <p>Si no hiciste esta solicitud, puedes ignorar este mensaje.</p>
      <hr>
      <small>Gestor Seguro - HR-Speed</small>
    `
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Error al enviar el correo:', err);
      return res.status(500).json({ message: 'Error al enviar el correo' });
    }
    console.log(`📧 Correo de recuperación enviado a ${email}`);
    res.status(200).json({ message: 'Correo enviado exitosamente' });
  });
});

app.post('/api/reset-password', (req, res) => {
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  const users = readJSON(USERS_FILE);

  if (!users[username]) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  try {
    // Encriptar la nueva contraseña
    const newEncrypted = encryptData({ password: newPassword }, newPassword);
    users[username].password = newEncrypted;

    writeJSON(USERS_FILE, users);
    console.log(`🔒 Contraseña restablecida para ${username}`);
    res.status(200).json({ message: 'Contraseña restablecida correctamente' });
  } catch (err) {
    console.error('❌ Error al restablecer contraseña:', err.message);
    res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
});


// SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor accesible desde tu red en http://192.168.1.35:${PORT}`);
});



