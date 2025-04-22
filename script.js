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
captureButton.addEventListener("click", async () => {
  debugLog("Botón 'Capturar Foto' presionado");

  const stream = video.srcObject;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  if (capabilities.torch) {
    try {
      // Activar flash y esperar su activación completa
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Flash activado");

      // Capturar foto mientras el flash está encendido
      capturePhoto();

      // Apagar el flash después de la captura
      await track.applyConstraints({ advanced: [{ torch: false }] });
      debugLog("Flash desactivado");
    } catch (e) {
      debugLog("Error al manejar el flash: " + e);
      console.error(e);
      // Capturar la foto sin flash si hay error
      capturePhoto();
    }
  } else {
    // Si no hay flash, tomar la foto normalmente
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
  
  const dataURL = canvas.toDataURL("image/png");
  lastImage.src = dataURL;
  debugLog("Imagen capturada y mostrada");
  
  const base64Image = dataURL.split(",")[1];
  //const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const endpoint = "https://script.google.com/macros/s/AKfycbyD4_GjEfY9Ntix9-5M9FghK-y97Od8kaS-WXm54wMv9d_8POFja2HJNI9sjbpsD9T9/exec";

  fetch(endpoint, {
    method: "POST",
    mode: "no-cors", // La respuesta será opaca
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image })
  })
  .then(response => {
    // Aquí no tendrás acceso a la respuesta real
    debugLog("Solicitud enviada en modo no-cors");
  })
  .catch(error => {
    debugLog("Error en la solicitud: " + error.message);
    console.error(error);
  });
  
}

