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
        
        videoElement.addEventListener('loadedmetadata', () => {
            adjustContainerSize();
            updateOverlay();
            checkHardwareCapabilities();
            logEvent('Cámara lista - Modo vertical');
        });
        
        window.addEventListener('resize', () => {
            adjustContainerSize();
            updateOverlay();
        });
        
    } catch (error) {
        logEvent(`Error de cámara: ${error.message}`);
    }
}

function adjustContainerSize() {
    const container = document.getElementById('camera-container');
    const aspectRatio = cameraConfig.resolution.width.exact / cameraConfig.resolution.height.exact;
    container.style.height = `${container.offsetWidth / aspectRatio}px`;
}

function updateOverlay() {
    const container = document.getElementById('camera-container');
    const minDimension = Math.min(container.offsetWidth, container.offsetHeight);
    const overlaySize = minDimension * 0.85;
    
    overlayElement.style.width = `${overlaySize}px`;
    overlayElement.style.height = `${overlaySize}px`;
}

async function captureImage() {
    const track = cameraStream.getVideoTracks()[0];
    
    try {
        document.getElementById('capture').disabled = true;
        
        if (track.getCapabilities().torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            await new Promise(r => setTimeout(r, cameraConfig.torch.warmup));
            isTorchActive = true;
        }

        const photoBlob = await captureInterface.takePhoto({
            imageWidth: 1080,
            imageHeight: 1920
        });
        
        if (currentCapture) URL.revokeObjectURL(currentCapture);
        currentCapture = URL.createObjectURL(photoBlob);
        showPreview();

    } catch (error) {
        logEvent(`Error de captura: ${error.message}`);
    } finally {
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

async function sendPhoto() {
    try {
        const response = await fetch(currentCapture);
        const blob = await response.blob();
        
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

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
window.addEventListener('beforeunload', () => {
    cameraStream?.getTracks().forEach(track => track.stop());
});

// Utilidades
function logEvent(message) {
    const logEntry = document.createElement('li');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    document.getElementById('log-list').appendChild(logEntry);
    console.log(message);
}

function checkHardwareCapabilities() {
    const track = cameraStream.getVideoTracks()[0];
    if (!track.getCapabilities().torch) {
        document.getElementById('warning-message').classList.remove('hidden');
    }
}