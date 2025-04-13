const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware para parsear JSON del body
app.use(express.json());

// Servir archivos estáticos desde la raíz
app.use(express.static(__dirname));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Aquí podrías agregar rutas para manejar usuarios, contraseñas, etc.
// Por ejemplo:
// app.post('/api/guardarUsuario', (req, res) => { ... });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

