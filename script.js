// Función para agregar mensajes de depuración tanto en la consola como en la página.
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

// Solicitar acceso a la cámara con la opción 'facingMode: environment' para usar la cámara trasera.
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    debugLog("Acceso a la cámara concedido");
    
    // Una vez carguen los metadatos del video, actualizar el overlay
    video.addEventListener("loadedmetadata", updateOverlay);
  })
  .catch(error => {
    debugLog("Error al acceder a la cámara: " + error);
    console.error(error);
  });

// Función para actualizar el overlay verde: lo hace un cuadrado que ocupa el 60% de la dimensión más pequeña.
function updateOverlay() {
  const container = document.getElementById("camera-container");
  const overlay = document.querySelector(".green-overlay-video");
  
  // Obtener dimensiones actuales del contenedor
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  // Calcular la dimensión menor y el 60% de la misma para que sea cuadrado
  const smaller = Math.min(width, height);
  const size = smaller * 0.6;
  
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = ((width - size) / 2) + "px";
  overlay.style.top = ((height - size) / 2) + "px";
  
  debugLog("Overlay actualizado: tamaño " + size + "px; contenedor " + width + "x" + height);
}

// Actualizar el overlay si cambia el tamaño de la ventana.
window.addEventListener("resize", updateOverlay);

// Función para capturar la foto, activando el flash solo durante ese instante.
captureButton.addEventListener("click", () => {
  debugLog("Botón 'Capturar Foto' presionado");
  
  // Obtener la pista del stream del video
  const stream = video.srcObject;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  
  // Si el dispositivo soporta torch (flash), activarlo temporalmente
  if (capabilities.torch) {
    track.applyConstraints({ advanced: [{ torch: true }] })
      .then(() => {
        debugLog("Flash activado temporalmente");
        // Esperar 100 ms y luego capturar la imagen
        setTimeout(() => {
          capturePhoto();
          // Desactivar el flash inmediatamente después de capturar
          track.applyConstraints({ advanced: [{ torch: false }] })
            .then(() => debugLog("Flash desactivado"))
            .catch(e => {
              debugLog("Error al desactivar el flash: " + e);
              console.error(e);
            });
        }, 100);
      })
      .catch(e => {
        debugLog("Error al activar el flash: " + e);
        console.error(e);
        // Si fallamos al activar el flash, capturamos la foto sin él.
        capturePhoto();
      });
  } else {
    // Si no hay flash disponible, capturamos la foto sin activarlo.
    capturePhoto();
  }
});

// Función que captura la imagen del video usando un canvas.
function capturePhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convertir a Data URL (imagen en formato PNG)
  const dataURL = canvas.toDataURL("image/png");
  
  // Mostrar la imagen capturada en la sección "Última imagen capturada"
  lastImage.src = dataURL;
  debugLog("Imagen capturada y mostrada en la sección 'Última imagen capturada'");
}
