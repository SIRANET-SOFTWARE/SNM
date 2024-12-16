require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
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

// Esquema para almacenamiento del token
const tokenSchema = new mongoose.Schema({
  accessToken: String,
  updatedAt: { type: Date, default: Date.now },
});
const Token = mongoose.model('Token', tokenSchema);

// Helper para guardar el token en la base de datos
async function storeAccessToken(token) {
  await Token.updateOne({}, { accessToken: token, updatedAt: Date.now() }, { upsert: true });
  console.log('Token actualizado en MongoDB:', token);
}

// Helper para obtener el token actual desde MongoDB
async function getAccessToken() {
  const tokenDoc = await Token.findOne();
  if (!tokenDoc) throw new Error('Token no encontrado en la base de datos.');
  return tokenDoc.accessToken;
}

// Ruta para recibir notificaciones
app.post('/webhook', async (req, res) => {
  console.log('Notificación recibida:', req.body);
  try {
    const notification = req.body;

    if (notification.topic && notification.resource) {
      // **Notificación de MercadoLibre**
      const resourceUrl = `https://api.mercadolibre.com${notification.resource}`;
      let apiResponse = {};
      let accessToken = await getAccessToken(); // Obtener el token desde MongoDB

      try {
        // Hacer el GET al recurso
        const response = await axios.get(resourceUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        apiResponse = response.data;
      } catch (error) {
        console.error('Error obteniendo el recurso de MercadoLibre:', error.message);

        // Intentar refrescar el token
        try {
          await authManager.refreshToken();
          const authConfig = await configManager.getAuthConfig();
          accessToken = authConfig.ACCESS_TOKEN;

          // Actualizar el token en MongoDB
          await storeAccessToken(accessToken);

          // Reintentar el GET
          const retryResponse = await axios.get(resourceUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          apiResponse = retryResponse.data;
        } catch (retryError) {
          console.error('Error obteniendo el recurso después de refrescar el token:', retryError.message);
        }
      }

      // Guardar en MongoDB
      const MercadoLibreNotification = mongoose.model('MercadoLibreNotification', new mongoose.Schema({
        notification: Object,
        apiResponse: Object,
      }, { timestamps: true }));
      await new MercadoLibreNotification({ notification, apiResponse }).save();

      return res.status(200).send('Notificación de MercadoLibre procesada');
    } else if (notification.store_id && notification.event) {
      // **Notificación de TiendaNube**
      const TiendaNubeNotification = mongoose.model('TiendaNubeNotification', new mongoose.Schema({
        notification: Object,
      }, { timestamps: true }));
      await new TiendaNubeNotification({ notification }).save();

      return res.status(200).send('Notificación de TiendaNube procesada');
    } else {
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
