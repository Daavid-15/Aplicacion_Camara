// Variables globales
let stream;
let imageCapture;

// Función para mostrar mensajes de depuración
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
const textInput = document.getElementById("text-input");
const sendTextButton = document.getElementById("send-text");

// Inicializa la cámara al máximo de resolución posible
async function initCamera() {
  try {
    // 1) Pedir únicamente facingMode; la resolución vendrá de los capabilities
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;

    // 2) Acceder a la pista de vídeo
    const track = stream.getVideoTracks()[0];

    // 3) Leer capacidades de resolución y forzar el máximo
    const videoCaps = track.getCapabilities();
    const maxW = videoCaps.width.max;
    const maxH = videoCaps.height.max;
    await track.applyConstraints({ width: maxW, height: maxH });

    // 4) Cuando cargue metadata, mostrar la resolución aplicada
    video.addEventListener("loadedmetadata", () => {
      updateOverlay();
      const settings = track.getSettings();
      debugLog(`Resolución de vídeo usada: ${settings.width}×${settings.height}`);
    });

    // 5) Crear el capturador de fotos
    imageCapture = new ImageCapture(track);

    // 6) Mostrar PhotoCapabilities (útil para saber el máximo de imagen fija)
    const photoCaps = await imageCapture.getPhotoCapabilities();
    debugLog("Capacidades de foto:\n" + JSON.stringify(photoCaps, null, 2));

  } catch (err) {
    debugLog("Error al inicializar cámara: " + err);
  }
}

// Redibuja el overlay verde centrado
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
  debugLog("Vista de vídeo restaurada");
}

// Captura la foto usando la máxima resolución de PhotoCapabilities
captureButton.addEventListener("click", async () => {
  debugLog("Iniciando captura de imagen...");
  const track = stream.getVideoTracks()[0];

  try {
    const caps = await imageCapture.getPhotoCapabilities();

    // Ajustar al máximo disponible
    const settings = {
      imageWidth: caps.imageWidth.max,
      imageHeight: caps.imageHeight.max
    };

    // Intentar flash nativo si existe
    //if (caps.fillLightMode?.includes("flash")) {  //Descartado, en mi movil salta el flash descordinado con la imagen
      //settings.fillLightMode = "flash";
      //debugLog("Usando flash integrado");
    //}
    // O activar torch manual
    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Linterna activada");
      await new Promise(r => setTimeout(r, 250)); //Tiempo para estabilizar el led
    }

    // Capturar la foto
    const blob = await imageCapture.takePhoto(settings);
    lastImage.src = URL.createObjectURL(blob);
    debugLog(`Foto capturada a ${settings.imageWidth}×${settings.imageHeight}`);

    // Apagar torch si se encendió
    if (caps.torch) {
      await new Promise(r => setTimeout(r, 250)); //Tiempo para estabilizar el led
      await track.applyConstraints({ advanced: [{ torch: false }] });
      debugLog("Linterna desactivada");
    }

    // Mostrar la imagen y los botones
    video.style.display = "none";
    lastImage.style.display = "block";
    sendButton.style.display = "block";
    discardButton.style.display = "block";
    captureButton.style.display = "none";
    updateOverlay();

  } catch (err) {
    debugLog("Error durante captura: " + err);
    // Asegurar linterna apagada
    try {
      await track.applyConstraints({ advanced: [{ torch: false }] });
    } catch {}
  }
});

// Envío de foto al backend
function sendPhoto() {
  if (!lastImage.src.startsWith("blob:")) {
    debugLog("No hay imagen para enviar");
    alert("No hay imagen para enviar");
    return;
  }
  debugLog("Enviando imagen...");
  fetch(lastImage.src)
    .then(res => res.blob())
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

// Envío de texto al backend
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

// Al cargar la página, arrancamos la cámara y precargamos texto
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
