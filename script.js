let videoWidth, videoHeight;  // Dimensiones de la cámara



// Función para mostrar mensajes de depuración en consola y en la lista HTML
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

async function listAllDeviceInfo() {
  try {
    // 1) Pide permiso para que labels y IDs estén disponibles
    await navigator.mediaDevices.getUserMedia({ video: true });

    // 2) Enumerar dispositivos
    const devices = await navigator.mediaDevices.enumerateDevices();

    // 3) Mostrar todo el array en tu lista de debug
    debugLog("Devices completos:\n" + JSON.stringify(devices, null, 2));

    // 4) (Opcional) Listar uno a uno en la lista de debug
    devices.forEach((dev, idx) => {
      debugLog(`Dispositivo #${idx}: kind=${dev.kind}; label=${dev.label}; id=${dev.deviceId}`);
    });

  } catch (err) {
    debugLog("No se pudo listar dispositivos: " + err);
  }
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

// Inicializa la cámara y muestra sus capacidades
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

    video.addEventListener("loadedmetadata", () => {
      updateOverlay();  
      const track = stream.getVideoTracks()[0];  
      const settings = track.getSettings();  
      videoWidth = settings.width || video.videoWidth;  
      videoHeight = settings.height || video.videoHeight;  
      debugLog(`Resolución de video: ${videoWidth}×${videoHeight}`);
    });

    const track = stream.getVideoTracks()[0];
    imageCapture = new ImageCapture(track);

    const caps = track.getCapabilities();
    debugLog("Capacidades de la cámara:\n" + JSON.stringify(caps, null, 2));
  } catch (err) {
    debugLog("Error cámara: " + err);
  }
}

// Centra y dimensiona el overlay
function updateOverlay() {
  const rect = container.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) * 0.85;
  const overlay = document.querySelector(".green-overlay-video");
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = (rect.width - size) / 2 + "px";
  overlay.style.top = (rect.height - size) / 2 + "px";
}

window.addEventListener("resize", updateOverlay);

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

// Captura la foto con dimensiones seguras según capacidades
captureButton.addEventListener("click", async () => {
  debugLog("Capturando imagen...");
  const track = stream.getVideoTracks()[0];

  try {
    const caps = await imageCapture.getPhotoCapabilities();  
    const desiredWidth = videoWidth;  
    const desiredHeight = videoHeight;  
    const settings = { imageWidth: desiredWidth, imageHeight: desiredHeight };

    if (caps.fillLightMode?.includes("flash")) {
      settings.fillLightMode = "flash";
      debugLog("Usando flash integrado");
    } else if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Linterna activada");
    }

    const blob = await imageCapture.takePhoto(settings);
    lastImage.src = URL.createObjectURL(blob);
    debugLog("Foto capturada");

    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] });
      debugLog("Linterna desactivada");
    }

    video.style.display = "none";
    lastImage.style.display = "block";
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    updateOverlay();

  } catch (err) {
    debugLog("Error en captura: " + err);
    await track.applyConstraints({ advanced: [{ torch: false }] }).catch(e => debugLog("Error apagando linterna: " + e));
  }
});

// Envía la imagen al backend
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
        fetch("https://script.google.com/macros/s/AKfycby4yc3nxuRn0Kv3GYrE4SuktP36noDnIkEasBa-FVcd6fY0qjQA691ZgXtHbm1INCHx/exec", {
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

// Envía texto al backend
function sendText() {
  const text = textInput.value.trim();
  if (!text) {
    debugLog("El campo de texto está vacío");
    alert("Por favor, escribe algo antes de enviar.");
    return;
  }
  debugLog("Enviando texto...");
  fetch("https://script.google.com/macros/s/AKfycby4yc3nxuRn0Kv3GYrE4SuktP36noDnIkEasBa-FVcd6fY0qjQA691ZgXtHbm1INCHx/exec", {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ message: text })
  })
    .then(() => debugLog("Texto enviado correctamente"))
    .catch(err => debugLog("Error enviando texto: " + err));
}

sendTextButton.addEventListener("click", sendText);

// Al cargar la página, listamos dispositivos y arrancamos la cámara
window.addEventListener("load", () => {
  listAllDeviceInfo();
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
