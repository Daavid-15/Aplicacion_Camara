// Función para agregar mensajes de depuración
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

// Elementos del DOM
const video = document.getElementById("video");
const lastImage = document.getElementById("lastImage");
const captureButton = document.getElementById("capture");
const sendButton = document.getElementById("send");
const discardButton = document.getElementById("discard");
const container = document.getElementById("camera-container");

// Variables globales
let stream;
let imageCapture;
let currentBlobUrl = null; // Para manejar URLs de objetos

// Inicialización de cámara mejorada
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        aspectRatio: { ideal: 16 / 9 }
      }
    });
    
    video.srcObject = stream;
    imageCapture = new ImageCapture(stream.getVideoTracks()[0]);

    video.addEventListener("loadedmetadata", () => {
      updateOverlay();
      checkFlashOrTorch();
      debugLog(`Resolución inicial: ${video.videoWidth}x${video.videoHeight}`);
    });

    window.addEventListener("resize", updateOverlay);
    
  } catch (error) {
    debugLog("Error inicializando cámara: " + error.message);
    alert("No se pudo acceder a la cámara. Por favor revisa los permisos.");
  }
}

// Actualización del overlay de enfoque
function updateOverlay() {
  const overlay = document.querySelector(".green-overlay-video");
  const rect = container.getBoundingClientRect();
  
  const size = Math.min(rect.width, rect.height) * 0.85;
  overlay.style.width = `${size}px`;
  overlay.style.height = `${size}px`;
  overlay.style.left = `${(rect.width - size) / 2}px`;
  overlay.style.top = `${(rect.height - size) / 2}px`;
}

// Gestión de estado de la cámara
function resetUIState() {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl); // Liberar memoria
    currentBlobUrl = null;
  }
  
  lastImage.src = "";
  lastImage.style.display = "none";
  video.style.display = "block";
  sendButton.style.display = "none";
  discardButton.style.display = "none";
  captureButton.style.display = "flex";
  document.querySelector(".green-overlay-video").style.display = "block";
  
  debugLog("Estado de UI reiniciado");
}

// Captura de foto optimizada
async function capturePhoto() {
  try {
    captureButton.disabled = true;
    debugLog("Iniciando captura...");

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    // Configuración de foto
    const photoSettings = {
      imageWidth: capabilities.width?.max || 1920,
      imageHeight: capabilities.height?.max || 1080
    };

    // Manejo de iluminación
    if (capabilities.fillLightMode?.includes("flash")) {
      photoSettings.fillLightMode = "flash";
      debugLog("Flash activado");
    } else if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Captura real con await
    const blob = await imageCapture.takePhoto(photoSettings);
    debugLog(`Foto capturada: ${blob.size} bytes`);

    // Limpiar iluminación
    if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] });
    }

    // Mostrar resultado
    currentBlobUrl = URL.createObjectURL(blob);
    lastImage.src = currentBlobUrl;
    video.style.display = "none";
    lastImage.style.display = "block";
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    document.querySelector(".green-overlay-video").style.display = "none";

  } catch (error) {
    debugLog("Error en captura: " + error.message);
    alert("Error al capturar la foto. Intenta nuevamente.");
  } finally {
    captureButton.disabled = false;
  }
}

// Envío de foto mejorado
async function sendPhoto() {
  if (!currentBlobUrl) {
    debugLog("Intento de envío sin foto");
    return;
  }

  try {
    debugLog("Comenzando envío...");
    const response = await fetch(currentBlobUrl);
    const blob = await response.blob();
    
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await fetch("TU_ENDPOINT_AQUI", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 })
    });

    debugLog("Foto enviada exitosamente");
    resetUIState();
    
  } catch (error) {
    debugLog("Error en envío: " + error.message);
  }
}

// Event Listeners seguros
document.addEventListener("DOMContentLoaded", initCamera);
captureButton.addEventListener("click", capturePhoto);
sendButton.addEventListener("click", sendPhoto);
discardButton.addEventListener("click", resetUIState);

// Gestión de advertencias
function checkFlashOrTorch() {
  const warningMessage = document.getElementById("warning-message");
  const track = stream.getVideoTracks()[0];
  
  if (!track.getCapabilities().fillLightMode && !track.getCapabilities().torch) {
    warningMessage.classList.remove("hidden");
    debugLog("Advertencia: Sin soporte para flash/torch");
    
    document.getElementById("close-warning").addEventListener("click", () => {
      warningMessage.classList.add("hidden");
    });
  }
}
