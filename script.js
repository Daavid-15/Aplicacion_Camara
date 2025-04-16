// Función para agregar mensajes de depuración en la consola y en el área de depuración de la página.
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById('debugList');
  const li = document.createElement('li');
  li.textContent = message;
  debugList.appendChild(li);
}

// Elementos del DOM que usaremos.
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photo = document.getElementById("photo");
const captureButton = document.getElementById("capture");

let stream;

// Solicitar acceso a la cámara usando la API getUserMedia para la cámara trasera.
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(s => {
    stream = s;
    video.srcObject = stream;
    debugLog("Acceso a la cámara concedido");
  })
  .catch(error => {
    console.error("Error al acceder a la cámara:", error);
    debugLog("Error al acceder a la cámara: " + error);
  });

// Añadir un evento al botón de captura.
captureButton.addEventListener("click", async () => {
  debugLog("Botón 'Capturar Foto' presionado");

  // Obtener la pista de video para, si es posible, activar el flash.
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  // Si el dispositivo soporta el flash (torch), intentamos activarlo.
  if (capabilities.torch) {
    try {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Flash activado");
    } catch (e) {
      console.error("Error al activar el flash:", e);
      debugLog("Error al activar el flash: " + e);
    }
  }

  // Esperar 100 ms para simular el flash y capturar la imagen.
  setTimeout(async () => {
    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Mostrar la imagen capturada en el elemento <img>
    photo.src = canvas.toDataURL("image/png");
    debugLog("Imagen capturada y mostrada");

    // Apagar el flash si se había activado.
    if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: false }] });
        debugLog("Flash desactivado");
      } catch (e) {
        console.error("Error al apagar el flash:", e);
        debugLog("Error al apagar el flash: " + e);
      }
    }

    // Enviar la imagen capturada al Apps Script.
    sendImageToAppsScript(photo.src);
  }, 100);
});

// Función para enviar la imagen capturada al Web App de Google Apps Script.
function sendImageToAppsScript(dataURL) {
  debugLog("Preparando imagen para enviar al Apps Script");

  // Eliminar la cabecera "data:image/png;base64," para quedarse con la cadena base64.
  const base64Image = dataURL.split(',')[1];
  const payload = { image: base64Image };

  // URL de tu Web App en Google Apps Script.
  const scriptURL = 'https://script.google.com/macros/s/AKfycbx8rXC77F7co76H7qAhsATZtG-E50qf6tYE_07RWSZTgsr6YJJ14a6SZXS71jAhQtHq/exec';

  fetch(scriptURL, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(payload)
  })
  .then(response => response.text())
  .then(result => {
     debugLog("Respuesta del servidor: " + result);
  })
  .catch(error => {
     console.error("Error al enviar la imagen:", error);
     debugLog("Error al enviar la imagen: " + error);
  });
}

