require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigManager = require('./configManager');
const AuthManager = require('./authManager');

const app = express();
// instantiate config manager
const configManager = new ConfigManager('./config.yaml');
// instantiate auth manager
const authManager = new AuthManager(configManager);

app.use(express.json());

// Configuración MongoDB
const mongoURI = process.env.MONGODB_URI; // URI de MongoDB desde el archivo .env
mongoose.connect(mongoURI)
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch((error) => console.error('Error conectando a MongoDB:', error));

// Esquema de la colección 'notificaciones'
const notificationSchema = new mongoose.Schema({
  notification: Object,
  apiResponse: Object, // Puede ser un objeto vacío si falla el GET
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

let accessToken = '';

// Ruta para recibir notificaciones
app.post('/webhook', async (req, res) => {
    
  try {

    const notification = req.body;

    console.log('Notificación recibida:', notification);
    console.log('Recurso:', notification.resource);
    
    // Intentar realizar GET al recurso proporcionado en la notificación
    const resourceUrl = `https://api.mercadolibre.com${notification.resource}`;

    let apiResponse = {};

    try {
      // Hacer el GET al recurso
      const response = await axios.get(resourceUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      });
      apiResponse = response.data; // Si la solicitud fue exitosa, guardar la respuesta
    } catch (error) {
      console.error('Error obteniendo el recurso:', error.message);
      // Intentar refrescar el token y hacer el GET nuevamente
      try {
        const response = await authManager.refreshToken();
        const newAccessToken = response.data.access_token;
        const retryResponse = await axios.get(resourceUrl, {
        headers: {
        Authorization: `Bearer ${newAccessToken}`,
        },
      });
      apiResponse = retryResponse.data; // Si la solicitud fue exitosa, guardar la respuesta
      } catch (retryError) {
      console.error('Error obteniendo el recurso después de refrescar el token:', retryError.message);
      // Si falla nuevamente, apiResponse se queda como un objeto vacío
      }
    }

    // Guardar la notificación y la respuesta (vacía si falló) en MongoDB
    const newNotification = new Notification({
      notification,
      apiResponse, // Vacío si no hubo respuesta
    });

    await newNotification.save();

    // Responder con 200 para confirmar la recepción de la notificación
    res.status(200).send('Notificación recibida y procesada, aunque sin respuesta');
  } catch (error) {
    console.error('Error procesando la notificación:', error);
    res.status(500).send('Error procesando la notificación');
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});

// Función para refrescar el token de acceso
async function refreshAccessToken() {

  const refreshTokenPath = path.join(__dirname, 'refreshToken.txt');
  const refreshToken = fs.readFileSync(refreshTokenPath, 'utf8').trim();

  console.log('Refrescando token de acceso...');
  console.log('Token de refresco:', refreshToken);

  const data = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.APP_ID,
    client_secret: process.env.CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', data, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Token de acceso refrescado:', response.data.access_token);

    const { access_token, refresh_token } = response.data;

    // Update refresh token and return access token
    fs.writeFileSync(refreshTokenPath, refresh_token);
    return access_token;

  } catch (error) {
    console.log('Failed to refresh token: ' + error.message);
    throw error;
  }
}

