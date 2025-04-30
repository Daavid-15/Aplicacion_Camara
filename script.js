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
      // Se omite el height y se usa aspectRatio para que se calcule en función del ancho
      aspectRatio: { ideal: 16/9 }
  
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
    let blob;
    // Captura la imagen sin opciones adicionales (ya que setOptions() no está disponible)
    blob = await imageCapture.takePhoto();
    debugLog("Foto capturada con takePhoto()");
    
    // Crear una imagen temporal para cargar el blob
    const tempImg = new Image();
    tempImg.onload = () => {
      // Aquí definimos la relación deseada, por ejemplo 16:9.
      const desiredAspectRatio = 16 / 9;
      
      // Usamos las dimensiones nativas del video como base
      const baseWidth = video.clientWidth;
      const desiredHeight = Math.floor(baseWidth / desiredAspectRatio);
      
      // Crear un canvas con las dimensiones deseadas
      const canvas = document.createElement("canvas");
      canvas.width = baseWidth;
      canvas.height = desiredHeight;
      const ctx = canvas.getContext("2d");
      
      // Dibujar la imagen; se ajusta al tamaño establecido
      ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
      
      // Extraer el blob del canvas (puedes elegir PNG que es lossless o JPEG con alta calidad)
      canvas.toBlob((resBlob) => {
        lastImage.src = URL.createObjectURL(resBlob);
        // Actualizamos la vista
        video.style.display = "none";
        lastImage.style.display = "block";
        sendButton.style.display = "inline-block";
        discardButton.style.display = "inline-block";
        captureButton.style.display = "none";
        updateOverlay();
        debugLog("Imagen reescalada a la relación " + desiredAspectRatio);
      }, "image/png");
    };
    tempImg.src = URL.createObjectURL(blob);
    
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
