// Función para agregar mensajes de depuración al cuadro de debug
function debugLog(message) {
  console.log(message); // También muestra el mensaje en la consola del navegador
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message; // Agrega el mensaje como un nuevo elemento de lista
  debugList.appendChild(li); // Lo añade al cuadro de depuración
}

// Referencias a los elementos del DOM
const video = document.getElementById("video"); // Elemento de video para mostrar la cámara
const lastImage = document.getElementById("lastImage"); // Imagen capturada
const captureButton = document.getElementById("capture"); // Botón para capturar una foto
const sendButton = document.getElementById("send"); // Botón para enviar la foto
const discardButton = document.getElementById("discard"); // Botón para descartar la foto
const container = document.getElementById("camera-container"); // Contenedor de la cámara

// Variables globales
let stream; // Flujo de video de la cámara
let imageCapture; // Objeto para capturar imágenes de la cámara

// Función para inicializar la cámara
function initCamera() {
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "environment", // Usa la cámara trasera si está disponible
        width: { ideal: 1920 }, // Resolución ideal de ancho
        aspectRatio: { ideal: 16 / 9 } // Relación de aspecto ideal
      }
    })
    .then(s => {
      stream = s; // Guarda el flujo de video
      video.srcObject = stream; // Asigna el flujo al elemento de video

      // Cuando se carguen los metadatos del video
      video.addEventListener("loadedmetadata", () => {
        updateOverlay(); // Actualiza el overlay verde
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings(); // Obtiene las configuraciones de la cámara
        const width = settings.width || video.videoWidth; // Ancho del video
        const height = settings.height || video.videoHeight; // Alto del video
        const aspectRatio = (width / height).toFixed(2); // Calcula la relación de aspecto
        debugLog(`Resolución del video: width = ${width}, height = ${height}, aspectRatio = ${aspectRatio}`);
      });

      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track); // Crea un objeto para capturar imágenes

      // Muestra las capacidades de la cámara en el cuadro de depuración
      const capabilities = track.getCapabilities();
      debugLog("Capacidades de la cámara:\n" + JSON.stringify(capabilities, null, 2));
    })
    .catch(error => debugLog("Error cámara: " + error)); // Muestra errores si no se puede acceder a la cámara
}

// Llama a la función para inicializar la cámara
initCamera();

// Evento para actualizar el overlay verde cuando se carguen los metadatos del video
video.addEventListener("loadedmetadata", checkFlashOrTorch);

// Función para actualizar el overlay verde
function updateOverlay() {
  const overlay = document.querySelector(".green-overlay-video");
  overlay.style.display = "block"; // Asegura que el overlay esté visible

  const rect = container.getBoundingClientRect(); // Obtiene las dimensiones del contenedor
  const width = rect.width;
  const height = rect.height;

  const smaller = Math.min(width, height); // Usa el tamaño más pequeño entre ancho y alto
  const size = smaller * 0.85; // Calcula el tamaño del overlay

  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = ((width - size) / 2) + "px";
  overlay.style.top = ((height - size) / 2) + "px";
}

// Actualiza el overlay si cambia el tamaño de la ventana
window.addEventListener("resize", updateOverlay);

// Función para restablecer la vista a su estado inicial
function resetCameraState() {
  lastImage.src = ""; // Limpia la imagen capturada
  lastImage.style.display = "none"; // Oculta la imagen
  video.style.display = "block"; // Muestra el video
  sendButton.style.display = "none"; // Oculta el botón de enviar
  discardButton.style.display = "none"; // Oculta el botón de descartar
  captureButton.style.display = "flex"; // Muestra el botón de capturar

  // Muestra el overlay verde
  const overlay = document.querySelector(".green-overlay-video");
  overlay.style.display = "block";

  updateOverlay(); // Actualiza el overlay
  debugLog("Volviendo a la vista de video");
}

// Evento para capturar una foto con flash (torch) si es posible
captureButton.addEventListener("click", async () => {
  debugLog("Capturando imagen ...");

  try {
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    const settings = track.getSettings();
    // Forzar la resolución de la imagen a la del video
    const width = settings.width || video.videoWidth;
    const height = settings.height || video.videoHeight;
    const photoSettings = { imageWidth: width, imageHeight: height };
    let blob;

    if (capabilities.fillLightMode && capabilities.fillLightMode.includes("flash")) {
      // Si soporta flash mediante fillLightMode, úsalo
      photoSettings.fillLightMode = "flash";
      blob = await imageCapture.takePhoto(photoSettings);
    }
    else if (capabilities.torch) {
      // Si el dispositivo soporta torch, actívalo
      await track.applyConstraints({ advanced: [{ torch: true }] });
      // Espera un breve instante para asegurar que el torch se encienda
      await new Promise(resolve => setTimeout(resolve, 100));
      blob = await imageCapture.takePhoto(photoSettings);
      // Apaga el torch después de tomar la foto
      await track.applyConstraints({ advanced: [{ torch: false }] });
    } 
    else {
      // En caso de que no se disponga de flash o torch, toma la foto normalmente
      blob = await imageCapture.takePhoto(photoSettings);
    }
    
    // Muestra la imagen capturada y ajusta la vista
    lastImage.src = URL.createObjectURL(blob);
    video.style.display = "none";
    lastImage.style.display = "block";
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    
    // Oculta el overlay verde
    const overlay = document.querySelector(".green-overlay-video");
    overlay.style.display = "none";
    
    debugLog("Foto capturada y flash/torch desactivado.");
  } catch (error) {
    debugLog("Error en captura: " + error);
  }
});


// Función para enviar la imagen capturada al back-end
function sendPhoto() {
  if (!lastImage.src || lastImage.src.indexOf("blob:") !== 0) {
    debugLog("No hay imagen para enviar");
    alert("No hay imagen para enviar");
    return;
  }

  debugLog("Enviando...");

  // Convierte la imagen capturada a base64 y la envía al servidor
  fetch(lastImage.src)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let base64Image = reader.result.split(",")[1];
        let endpoint = "https://script.google.com/macros/s/AKfycbyp-_LEh2vpD6s48Rly9bmurJGWD0FdjjzXWTqlyiLA2lZl6kLBa3QCb2nvvR4oK_yu/exec";
        fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image })
        })
          .then(() => {
            debugLog("Imagen enviada correctamente");
            resetCameraState(); // Restablece la vista después de enviar
          })
          .catch(err => debugLog("Error enviando la imagen: " + err.message));
      };
      reader.readAsDataURL(blob); // Convierte el blob a base64
    })
    .catch(err => debugLog("Error procesando la imagen: " + err));
}

// Asigna eventos a los botones de enviar y descartar
sendButton.addEventListener("click", sendPhoto);
discardButton.addEventListener("click", () => {
  debugLog("Imagen descartada");
  resetCameraState(); // Restablece la vista al descartar
});

// Función para verificar si la cámara tiene acceso a Flash o Torch
function checkFlashOrTorch() {
  const warningMessage = document.getElementById("warning-message");
  const closeWarningButton = document.getElementById("close-warning");
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  if (!capabilities.fillLightMode && !capabilities.torch) {
    warningMessage.classList.remove("hidden"); // Muestra el mensaje de advertencia
    debugLog("Advertencia: No se detectó acceso a Flash o Torch.");
  }

  // Evento para cerrar el mensaje de advertencia
  closeWarningButton.addEventListener("click", () => {
    warningMessage.classList.add("hidden"); // Oculta el mensaje de advertencia
    debugLog("Mensaje de advertencia cerrado.");
  });
}


