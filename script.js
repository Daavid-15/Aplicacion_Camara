// Función para agregar mensajes de depuración en la consola y en el DOM.
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

const video = document.getElementById("video");
const captureButton = document.getElementById("capture");
const lastImage = document.getElementById("lastImage");

// Solicitar acceso a la cámara (usando la cámara trasera)
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    debugLog("Acceso a la cámara concedido");
    // Cuando se carguen los metadatos (dimensiones) del video, actualizar el overlay.
    video.addEventListener("loadedmetadata", updateOverlay);
  })
  .catch(error => {
    debugLog("Error al acceder a la cámara: " + error);
    console.error(error);
  });

// Función para actualizar el tamaño y posición del overlay verde (cuadrado)
// El overlay ocupará el 60% de la dimensión más pequeña del contenedor.
function updateOverlay() {
  const container = document.getElementById("camera-container");
  const overlay = document.querySelector(".green-overlay-video");
  
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  // Tomar la dimensión menor y el 60% de esa dimensión
  const smaller = Math.min(width, height);
  const size = smaller * 0.6;
  
  // Configurar el overlay para que sea un cuadrado y esté centrado
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = ((width - size) / 2) + "px";
  overlay.style.top = ((height - size) / 2) + "px";
  
  
}

// Actualizar el overlay si cambia el tamaño de la ventana.
window.addEventListener("resize", updateOverlay);

// Función para capturar la imagen, activar el flash temporalmente y luego enviarla
captureButton.addEventListener("click", () => {
  debugLog("Botón 'Capturar Foto' presionado");
  
  const stream = video.srcObject;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  
  // Si el dispositivo soporta flash (torch), activarlo sólo durante la captura.
  if (capabilities.torch) {
    track.applyConstraints({ advanced: [{ torch: true }] })
      .then(() => {
        debugLog("Flash activado");
        setTimeout(() => {
          capturePhoto();
          // Desactivar el flash inmediatamente después de la captura.
          track.applyConstraints({ advanced: [{ torch: false }] })
            .then(() => debugLog("Flash desactivado"))
            .catch(e => {
              debugLog("Error al desactivar el flash: " + e);
              console.error(e);
            });
        }, 100); // El flash se activa por 100 ms.
      })
      .catch(e => {
        debugLog("Error al activar el flash: " + e);
        console.error(e);
        // Si falla activar el flash, capturamos la foto sin él.
        capturePhoto();
      });
  } else {
    // Si no hay flash, solo capturamos la foto.
    capturePhoto();
  }
});

// Función para capturar la imagen del video y enviarla al endpoint
function capturePhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convertir el canvas a una Data URL
  const dataURL = canvas.toDataURL("image/png");
  
  // Mostrar la imagen capturada en la sección "Última imagen capturada"
  lastImage.src = dataURL;
  debugLog("Imagen capturada y mostrada en 'Última imagen capturada'");
  
  // Preparar la imagen (eliminar la cabecera) para enviarla en formato Base64
  const base64Image = dataURL.split(",")[1];
  const payload = { image: base64Image };
  
  // Endpoint al que se enviará la imagen
  const endpoint = "https://script.google.com/macros/s/AKfycbx8rXC77F7co76H7qAhsATZtG-E50qf6tYE_07RWSZTgsr6YJJ14a6SZXS71jAhQtHq/exec";
  
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(response => response.text())
    .then(result => {
      debugLog("Imagen enviada, respuesta: " + result);
    })
    .catch(error => {
      debugLog("Error al enviar la imagen: " + error);
      console.error(error);
    });
}