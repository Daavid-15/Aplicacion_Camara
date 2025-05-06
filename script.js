let cameraStream = null;
let captureInterface = null;
let currentCapture = null;
let isTorchActive = false;

const videoElement = document.getElementById('video');
const captureElement = document.getElementById('lastImage');
const overlayElement = document.querySelector('.green-overlay');

const cameraConfig = {
    resolution: {
        width: { exact: 1080 },
        height: { exact: 1920 },
        aspectRatio: 9/16
    },
    torch: {
        warmup: 600,
        cooldown: 400
    }
};

// Función de envío recuperada y mejorada
async function sendPhoto() {
    if (!currentCapture) {
        logEvent('Error: No hay imagen para enviar');
        return;
    }

    try {
        const response = await fetch(currentCapture);
        const blob = await response.blob();
        
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        // Endpoint real (reemplazar)
        await fetch('TU_ENDPOINT_AQUI', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
        });
        
        logEvent('Imagen enviada exitosamente');
        resetInterface();

    } catch (error) {
        logEvent(`Error en envío: ${error.message}`);
    }
}

async function initializeCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                ...cameraConfig.resolution
            }
        });
        
        videoElement.srcObject = cameraStream;
        captureInterface = new ImageCapture(cameraStream.getVideoTracks()[0]);
        
        videoElement.onloadedmetadata = () => {
            adjustContainerSize();
            checkHardwareCapabilities();
            logEvent('Cámara vertical inicializada');
        };

    } catch (error) {
        logEvent(`Error de cámara: ${error.message}`);
    }
}

function adjustContainerSize() {
    const container = document.getElementById('camera-container');
    const videoRatio = cameraConfig.resolution.width.exact / cameraConfig.resolution.height.exact;
    
    // Forzar tamaño vertical
    container.style.width = `${window.innerWidth * 0.9}px`;
    container.style.height = `${window.innerWidth * 1.777}px`;
    updateOverlay();
}

function updateOverlay() {
    const container = document.getElementById('camera-container');
    const containerWidth = container.offsetWidth;
    const overlaySize = containerWidth * 0.85;
    
    overlayElement.style.width = `${overlaySize}px`;
    overlayElement.style.height = `${overlaySize * 1.777}px`;
}

async function captureImage() {
    const track = cameraStream.getVideoTracks()[0];
    
    try {
        document.getElementById('capture').disabled = true;
        
        // Activación de linterna
        if (track.getCapabilities().torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            await new Promise(r => setTimeout(r, cameraConfig.torch.warmup));
            isTorchActive = true;
        }

        // Captura vertical
        const photoBlob = await captureInterface.takePhoto({
            imageWidth: 1080,
            imageHeight: 1920
        });
        
        // Mostrar imagen
        if (currentCapture) URL.revokeObjectURL(currentCapture);
        currentCapture = URL.createObjectURL(photoBlob);
        showPreview();

    } catch (error) {
        logEvent(`Error de captura: ${error.message}`);
    } finally {
        // Desactivación garantizada
        if (track.getCapabilities().torch && isTorchActive) {
            await new Promise(r => setTimeout(r, cameraConfig.torch.cooldown));
            await track.applyConstraints({ advanced: [{ torch: false }] });
            isTorchActive = false;
        }
        document.getElementById('capture').disabled = false;
    }
}

function showPreview() {
    captureElement.src = currentCapture;
    videoElement.style.display = 'none';
    captureElement.style.display = 'block';
    document.getElementById('send').style.display = 'inline-block';
}

function resetInterface() {
    videoElement.style.display = 'block';
    captureElement.style.display = 'none';
    document.getElementById('send').style.display = 'none';
    if (currentCapture) URL.revokeObjectURL(currentCapture);
    currentCapture = null;
}

// Event Listeners
document.getElementById('capture').addEventListener('click', captureImage);
document.getElementById('discard').addEventListener('click', resetInterface);
document.getElementById('send').addEventListener('click', sendPhoto);
document.getElementById('close-warning').addEventListener('click', () => {
    document.getElementById('warning-message').classList.add('hidden');
});

// Inicialización
document.addEventListener('DOMContentLoaded', initializeCamera);
window.addEventListener('resize', () => {
    adjustContainerSize();
    updateOverlay();
});

// Utilidades
function logEvent(message) {
    const logEntry = document.createElement('li');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    document.getElementById('log-list').appendChild(logEntry);
    console.log(message);
}