require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Configuración MongoDB
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((error) => console.error('Error conectando a MongoDB:', error));

// Esquema de la colección 'notificaciones'
const notificationSchema = new mongoose.Schema({
  notification: Object,
  apiResponse: Object,
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

// Crear la interfaz para leer la entrada del teclado
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para buscar notificaciones por tópico
const buscarPorTopico = async (topic) => {
  try {
    // Realizar la búsqueda por el campo 'notification.topic'
    const resultados = await Notification.find({ 'notification.topic': topic });
    
    if (resultados.length === 0) {
      console.log(`No se encontraron notificaciones para el tópico: ${topic}`);
    } else {
      /*  
      console.log(`Notificaciones encontradas para el tópico: ${topic}`);
      resultados.forEach((notificacion, index) => {
        console.log(`\nNotificación ${index + 1}:`);
        console.log('Notificación:', JSON.stringify(notificacion.notification, null, 2));
        console.log('Respuesta de la API:', JSON.stringify(notificacion.apiResponse, null, 2));
      });
      */
      console.log(resultados[resultados.length - 1])
    }
  } catch (error) {
    console.error('Error buscando notificaciones:', error);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

// Solicitar el tópico al usuario
rl.question('Ingrese el tópico de interés: ', (topic) => {
  buscarPorTopico(topic);
});
