// Función para mostrar mensajes de depuración en consola y en la lista HTML
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
const textInput = document.getElementById("text-input");
const sendTextButton = document.getElementById("send-text");

let stream;
let imageCapture;

// Inicializa la cámara y obtiene el stream
function initCamera() {
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        aspectRatio: { ideal: 16 / 9 }
      }
    })
    .then(s => {
      stream = s;
      video.srcObject = stream;

      video.addEventListener("loadedmetadata", () => {
        updateOverlay();
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        const width = settings.width || video.videoWidth;
        const height = settings.height || video.videoHeight;
        const aspectRatio = (width / height).toFixed(2);
        debugLog(`Resolución de video: ${width}×${height} (AR=${aspectRatio})`);
      });

      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track);

      const caps = track.getCapabilities();
      debugLog("Capacidades de la cámara:\n" + JSON.stringify(caps, null, 2));
    })
    .catch(err => debugLog("Error cámara: " + err));
}

// Centra y dimensiona el overlay verde al 85% de la menor dimensión
function updateOverlay() {
  const rect = container.getBoundingClientRect();
  const smaller = Math.min(rect.width, rect.height);
  const size = smaller * 0.85;
  const overlay = document.querySelector(".green-overlay-video");
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = (rect.width - size) / 2 + "px";
  overlay.style.top = (rect.height - size) / 2 + "px";
}

window.addEventListener("resize", updateOverlay);

// Vuelve al estado inicial de la cámara tras enviar o descartar
function resetCameraState() {
  lastImage.src = "";
  lastImage.style.display = "none";
  video.style.display = "block";
  sendButton.style.display = "none";
  discardButton.style.display = "none";
  captureButton.style.display = "flex";
  updateOverlay();
  debugLog("Vista de video restaurada");
}

// Captura la foto usando parámetros válidos según PhotoCapabilities
captureButton.addEventListener("click", async () => {
  debugLog("Capturando imagen...");
  const track = stream.getVideoTracks()[0];

  try {
    const caps = await imageCapture.getPhotoCapabilities();
    // Calculamos un tamaño dentro de lo soportado
    const desiredWidth = Math.min(caps.imageWidth.max || video.videoWidth, 1920);
    const desiredHeight = Math.min(caps.imageHeight.max || video.videoHeight, 1080);
    const photoSettings = {
      imageWidth: desiredWidth,
      imageHeight: desiredHeight
    };

    // Intentar usar flash nativo si está disponible
    if (caps.fillLightMode && caps.fillLightMode.includes("flash")) {
      photoSettings.fillLightMode = "flash";
      debugLog("PhotoSettings con flash: " + JSON.stringify(photoSettings));
    }
    // Si no hay flash nativo pero sí torch, encender linterna manualmente
    else if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Linterna activada manualmente");
    }

    const blob = await imageCapture.takePhoto(photoSettings);
    lastImage.src = URL.createObjectURL(blob);
    debugLog("Foto capturada");

    // Apagar torch si se encendió
    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] });
      debugLog("Linterna desactivada");
    }

    // Mostrar foto y botones
    video.style.display = "none";
    lastImage.style.display = "block";
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    updateOverlay();

  } catch (err) {
    debugLog("Error en captura: " + err);
    // Asegurarse de apagar torch en caso de fallo
    try {
      await track.applyConstraints({ advanced: [{ torch: false }] });
    } catch (e) {
      debugLog("Error apagando linterna tras fallo: " + e);
    }
  }
});

// Envía la imagen capturada al backend y restaura la vista
function sendPhoto() {
  if (!lastImage.src.startsWith("blob:")) {
    debugLog("No hay imagen para enviar");
    alert("No hay imagen para enviar");
    return;
  }

  debugLog("Enviando imagen...");
  fetch(lastImage.src)
    .then(r => r.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        const endpoint = "https://script.google.com/macros/s/AKfycbz9YGEzg9ZJWNjX0_1LHTrctHz4Qigj4vlyzBBEtluezUU9QRLsQjkx2OdV4AKgio0r/exec";
        fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify({ image: base64 })
        })
          .then(() => {
            debugLog("Imagen enviada correctamente");
            resetCameraState();
          })
          .catch(err => debugLog("Error enviando imagen: " + err));
      };
      reader.readAsDataURL(blob);
    })
    .catch(err => debugLog("Error procesando blob: " + err));
}

sendButton.addEventListener("click", sendPhoto);
discardButton.addEventListener("click", () => {
  debugLog("Imagen descartada");
  resetCameraState();
});

// Envía el texto al backend (clave "message")
function sendText() {
  const text = textInput.value.trim();
  if (!text) {
    debugLog("El campo de texto está vacío");
    alert("Por favor, escribe algo antes de enviar.");
    return;
  }

  debugLog("Enviando texto...");
  const endpoint = "https://script.google.com/macros/s/AKfycbz9YGEzg9ZJWNjX0_1LHTrctHz4Qigj4vlyzBBEtluezUU9QRLsQjkx2OdV4AKgio0r/exec";
  fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ message: text })
  })
    .then(() => debugLog("Texto enviado correctamente"))
    .catch(err => debugLog("Error enviando texto: " + err));
}

sendTextButton.addEventListener("click", sendText);

// Al cargar la página, inicializamos cámara y preload de texto
window.addEventListener("load", () => {
  initCamera();
  textInput.value = `//tensor_superpoint_1024_BAJO_CARBONO_0.pt
//tensor_superpoint_1024_CABLES_Y_MUELLES_0.pt
///tensor_superpoint_1024_ESTAMPACION_0.pt
tensor_superpoint_1024_NAN_0.pt
tensor_superpoint_1024_NEUMATICOS_0.pt
tensor_superpoint_1024_NO_ENCONTRADO_0.pt
//tensor_superpoint_1024_OTROS_0.pt
//tensor_superpoint_1024_PRETENSADOS_0.pt
//tensor_superpoint_1024_PSEUDO_0.pt`;
});
