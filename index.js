require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuración MongoDB
const mongoURI = process.env.MONGO_URI; // URI de MongoDB desde el archivo .env
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch((error) => console.error('Error conectando a MongoDB:', error));

// Esquema de la colección 'notificaciones'
const notificationSchema = new mongoose.Schema({
  notification: Object,
  apiResponse: Object, // Puede ser un objeto vacío si falla el GET
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

// Ruta para recibir notificaciones
app.post('/webhook', async (req, res) => {
  try {
    const notification = req.body;

    // Intentar realizar GET al recurso proporcionado en la notificación
    const resourceUrl = `https://api.mercadolibre.com${notification.resource}`;
    const accessToken = process.env.ACCESS_TOKEN; // Token de acceso a MercadoLibre

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
      // Si falla, apiResponse se queda como un objeto vacío
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
