// Función para agregar mensajes de depuración 
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
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      
      // Actualizar el overlay cuando se carguen los metadatos
      video.addEventListener("loadedmetadata", updateOverlay);
      
      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track);
      
      // Mostrar capacidades de la cámara
      const capabilities = track.getCapabilities();
      debugLog("Cámara:" + JSON.stringify({
        flash: capabilities.fillLightMode || 'no soportado',
        torch: capabilities.torch ? 'soportado' : 'no soportado'
      }));
      
    }).catch(error => debugLog("Error cámara: " + error));
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
  const size = smaller * 0.6;
  
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
function resetCameraState() {
  lastImage.src = "";
  lastImage.style.display = "none";
  video.style.display = "block";
  sendButton.style.display = "none";
  discardButton.style.display = "none";
  captureButton.style.display = "inline-block";
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
    
    // 1. Usar flash nativo si está disponible.
    if (capabilities.fillLightMode?.includes("flash")) {
      await imageCapture.setOptions({ fillLightMode: "flash" });
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto con flash");
    } 
    // 2. Usar antorcha si el flash nativo no está disponible.
    else if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: true }] });
        debugLog("Linterna activada");
        await new Promise(resolve => setTimeout(resolve, 200)); // Espera para estabilización
        const blob = await imageCapture.takePhoto();
        lastImage.src = URL.createObjectURL(blob);
        debugLog("Foto sacada");
      } finally {
        if (track && capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: false }] })
            .then(() => debugLog("Linterna desactivada"))
            .catch(err => debugLog("Error apagando linterna: " + err));
        }
      }
    } 
    // 3. Captura sin flash.
    else {
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto sin flash");
    }
    
    // Mostrar la imagen capturada en el contenedor manteniendo el overlay.
    video.style.display = "none";
    lastImage.style.display = "block";
    
    // Mostrar los botones de enviar y descartar, y ocultar el de capturar.
    sendButton.style.display = "inline-block";
    discardButton.style.display = "inline-block";
    captureButton.style.display = "none";
    
    // Actualizamos el overlay en caso de que la disposición cambie.
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
