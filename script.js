function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

const video = document.getElementById("video");
const lastImage = document.getElementById("lastImage");
const captureButton = document.getElementById("capture");
const sendButton = document.getElementById("send");
const discardButton = document.getElementById("discard");
const container = document.getElementById("camera-container");

let stream;
let imageCapture;

// Inicializa la cámara
function initCamera() {
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        // Se omite el height y se usa aspectRatio para que se calcule en función del ancho
        aspectRatio: { ideal: 16 / 9 }
      }
    })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      
      // Cuando se carguen los metadatos, actualizamos el overlay y mostramos las dimensiones.
      video.addEventListener("loadedmetadata", () => {
        updateOverlay();
        // Usamos getSettings() para asegurarnos de obtener las dimensiones reales
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        // Si settings.width/height no están definidos, usamos las propiedades del video
        const width = settings.width || video.videoWidth;
        const height = settings.height || video.videoHeight;
        const aspectRatio = (width / height).toFixed(2);
        debugLog(`Resolución del video: width = ${width}, height = ${height}, aspectRatio = ${aspectRatio}`);
      });
      
      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track);
      
      // Mostrar todas las capacidades de la cámara
      const capabilities = track.getCapabilities();
      // Se utiliza JSON.stringify con formato de indentación para una lectura más cómoda
      debugLog("Capacidades de la cámara:\n" + JSON.stringify(capabilities, null, 2));
      
    })
    .catch(error => debugLog("Error cámara: " + error));
}



initCamera();

// Función para actualizar el tamaño y posición del overlay verde (cuadrado)
// El overlay ocupará el 60% de la dimensión menor del contenedor.
function updateOverlay() {
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  // Tomar la dimensión menor y el 60% de esa dimensión
  const smaller = Math.min(width, height);
  const size = smaller * 0.85;
  
  // Configurar el overlay para que sea un cuadrado centrado
  const overlay = document.querySelector(".green-overlay-video");
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = ((width - size) / 2) + "px";
  overlay.style.top = ((height - size) / 2) + "px";
}

// Actualiza el overlay si cambia el tamaño de la ventana
window.addEventListener("resize", updateOverlay);

// Función para restablecer la vista:
// Oculta la imagen, muestra el video, oculta los botones de enviar/descartar y vuelve a mostrar el botón de capturar.
// Función para restablecer la vista
function resetCameraState() {
  lastImage.src = "";
  lastImage.style.display = "none";
  video.style.display = "block";
  sendButton.style.display = "none";
  discardButton.style.display = "none";
  captureButton.style.display = "flex";
  updateOverlay();
  debugLog("Volviendo a la vista de video");
}

// Evento para capturar la foto
captureButton.addEventListener("click", async () => {
  debugLog("Capturando imagen...");
  
  let track;
  try {
    track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    // Definir los photoSettings que deseas utilizar
    // Es recomendable definir imageWidth e imageHeight dentro de los límites que soporte el dispositivo.
    let photoSettings = {
      imageWidth: 1920,   // Valor deseado: ajusta según tus necesidades o consulta las capacidades
      imageHeight: 1080,  // Valor deseado
    };
    
    // Si el dispositivo soporta flash nativo, lo establecemos en los settings
    if (capabilities.fillLightMode && capabilities.fillLightMode.includes("flash")) {

      photoSettings.fillLightMode = "flash";
      debugLog("Configurar photoSettings con flash: " + JSON.stringify(photoSettings));
    }
  
    // Si no, pero existe la opción torch, lo activamos manualmente
    else if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: true }] });
        debugLog("Linterna activada manualmente");
      } catch (err) {
        debugLog("Error al activar linterna: " + err);
      }
    }
  
    // Ahora se captura la fotografía pasando los photoSettings deseados.
    const blob = await imageCapture.takePhoto(photoSettings);
    lastImage.src = URL.createObjectURL(blob);
    debugLog("Foto capturada con settings: " + JSON.stringify(photoSettings));
    
    // Si se activó torch, desactívala (para asegurar que siga apagada)
    if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .then(() => debugLog("Linterna desactivada"))
        .catch(err => debugLog("Error apagando linterna: " + err));
    }
    
    // Mostrar la imagen capturada en el contenedor
    video.style.display = "none";
    lastImage.style.display = "block";
    
    // Mostrar los botones
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    
    // Actualizar el overlay
    updateOverlay();
    
  } catch (error) {
    debugLog("Error en captura: " + error);
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error limpiando flash: " + err));
    }
    throw error;
  } finally {
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error final apagando flash: " + err));
    }
  }
});

// Función para enviar la imagen capturada al back-end y restablecer la vista
function sendPhoto() {
  if (!lastImage.src || lastImage.src.indexOf("blob:") !== 0) {
    debugLog("No hay imagen para enviar");
    alert("No hay imagen para enviar");
    return;
  }
  
  // Mostrar mensaje "Enviando..." en la depuración
  debugLog("Enviando...");
  
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
            resetCameraState();
          })
          .catch(err => debugLog("Error enviando la imagen: " + err.message));
      };
      reader.readAsDataURL(blob);
    })
    .catch(err => debugLog("Error procesando la imagen: " + err));
}

// Asignar eventos a los botones de enviar y descartar
sendButton.addEventListener("click", sendPhoto);
discardButton.addEventListener("click", () => {
  debugLog("Imagen descartada");
  resetCameraState();
});