require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigManager = require('./configManager');
const AuthManager = require('./authManager');

const app = express();

// Instanciar configuraciones y manejadores
const configManager = new ConfigManager('./config.yaml');
const authManager = new AuthManager(configManager);

app.use(express.json());

// Configuración MongoDB
const mongoURI = process.env.MONGODB_URI; // URI de MongoDB desde el archivo .env
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((error) => console.error('Error conectando a MongoDB:', error));

// Esquemas de MongoDB
const mercadoLibreSchema = new mongoose.Schema({
  notification: Object,
  apiResponse: Object, // Puede ser un objeto vacío si falla el GET
}, { timestamps: true });

const tiendaNubeSchema = new mongoose.Schema({
  notification: Object,
}, { timestamps: true });

// Define the Token schema and model
const tokenSchema = new mongoose.Schema({
  access_token: String,
});


const MercadoLibreNotification = mongoose.model('MercadoLibreNotification', mercadoLibreSchema);
const TiendaNubeNotification = mongoose.model('TiendaNubeNotification', tiendaNubeSchema);
const Token = mongoose.model('Token', tokenSchema);


let accessToken = ''; // Token para MercadoLibre

// Ruta para recibir notificaciones
app.post('/webhook', async (req, res) => {
  // Print the body of any notification received
  console.log('Notificación recibida:', req.body);  
  try {
    const notification = req.body;

    // Determinar el origen de la notificación
    if (notification.topic && notification.resource) {
      // **Notificación de MercadoLibre**
      // console.log('Notificación de MercadoLibre recibida:', notification);
      console.log("Notification received from MercadoLibre");
      console.log(`Current access token: ${accessToken}`);

      // Procesar notificación de MercadoLibre
      const resourceUrl = `https://api.mercadolibre.com${notification.resource}`;
      let apiResponse = {};

      try {
        // Hacer el GET al recurso
        const response = await axios.get(resourceUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        apiResponse = response.data;
      } catch (error) {
        console.error('Error obteniendo el recurso de MercadoLibre:', error.message);

        // Intentar refrescar el token
        try {
          await authManager.refreshToken();
          const authConfig = await configManager.getAuthConfig();
          accessToken = authConfig.ACCESS_TOKEN;

            // Update the token in the database
            await Token.findOneAndUpdate({}, { access_token: accessToken }, { upsert: true });

          // Reintentar el GET
          const retryResponse = await axios.get(resourceUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          apiResponse = retryResponse.data;
        } catch (retryError) {
          console.error('Error obteniendo el recurso después de refrescar el token:', retryError.message);
        }
      }

      // Guardar en MongoDB
      const newNotification = new MercadoLibreNotification({ notification, apiResponse });
      await newNotification.save();

      return res.status(200).send('Notificación de MercadoLibre procesada');
    } else if (notification.store_id && notification.event) {
      // **Notificación de TiendaNube**
      // console.log('Notificación de TiendaNube recibida:', notification);

      // Guardar en MongoDB
      const newNotification = new TiendaNubeNotification({ notification });
      await newNotification.save();

      return res.status(200).send('Notificación de TiendaNube procesada');
    } else {
      // Notificación desconocida
      console.warn('Notificación desconocida recibida:', notification);
      return res.status(400).send('Formato de notificación desconocido');
    }
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

// Función para refrescar el token de acceso (ya gestionada por AuthManager)
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
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Token de acceso refrescado:', response.data.access_token);

    const { access_token, refresh_token } = response.data;

    // Actualizar token de refresco y devolver token de acceso
    fs.writeFileSync(refreshTokenPath, refresh_token);
    return access_token;
  } catch (error) {
    console.log('Fallo al refrescar el token:', error.message);
    throw error;
  }
}