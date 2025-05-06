let cameraStream = null;
let captureInterface = null;
let currentCapture = null;
let isTorchActive = false;

const videoElement = document.getElementById('video');
const captureElement = document.getElementById('lastImage');
const overlayElement = document.querySelector('.green-overlay');

const cameraConfig = {
    resolution: {
        width: { exact: 1080 },  // Modo vertical
        height: { exact: 1920 },
        aspectRatio: { exact: 9/16 }
    },
    torch: {
        warmup: 600,    // Tiempo de activación
        cooldown: 400   // Tiempo de desactivación
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
            updateOverlayPosition();
            checkHardwareCapabilities();
            logEvent('Cámara lista - Modo vertical');
        });
        
        window.addEventListener('resize', updateOverlayPosition);
        
    } catch (error) {
        handleCameraError(error);
    }
}

function updateOverlayPosition() {
    const container = document.getElementById('camera-container');
    const containerRect = container.getBoundingClientRect();
    
    // Calcular 85% de la dimensión más pequeña
    const minDimension = Math.min(containerRect.width, containerRect.height);
    const overlaySize = minDimension * 0.85;
    
    overlayElement.style.width = `${overlaySize}px`;
    overlayElement.style.height = `${overlaySize}px`;
}

async function captureImage() {
    const captureButton = document.getElementById('capture');
    let videoTrack;
    
    try {
        captureButton.disabled = true;
        videoTrack = cameraStream.getVideoTracks()[0];
        
        // Manejo de linterna
        if (videoTrack.getCapabilities().torch) {
            await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
            await new Promise(r => setTimeout(r, cameraConfig.torch.warmup));
            isTorchActive = true;
        }

        // Captura con resolución vertical
        const photoBlob = await captureInterface.takePhoto({
            imageWidth: 1080,
            imageHeight: 1920
        });
        
        // Actualizar vista
        if (currentCapture) URL.revokeObjectURL(currentCapture);
        currentCapture = URL.createObjectURL(photoBlob);
        showCapturedImage();
        
    } catch (error) {
        logEvent(`Error en captura: ${error.message}`);
    } finally {
        await handleTorchDeactivation(videoTrack);
        captureButton.disabled = false;
    }
}

function showCapturedImage() {
    captureElement.src = currentCapture;
    videoElement.style.opacity = '0';
    
    setTimeout(() => {
        videoElement.style.display = 'none';
        captureElement.style.display = 'block';
        videoElement.style.opacity = '1';
    }, 300);
    
    logEvent('Foto capturada - 1080x1920px');
}

async function handleTorchDeactivation(track) {
    if (track?.getCapabilities().torch && isTorchActive) {
        await new Promise(r => setTimeout(r, cameraConfig.torch.cooldown));
        await track.applyConstraints({ advanced: [{ torch: false }] });
        isTorchActive = false;
    }
}

function checkHardwareCapabilities() {
    const track = cameraStream.getVideoTracks()[0];
    const warningElement = document.getElementById('warning-message');
    
    if (!track.getCapabilities().torch) {
        warningElement.classList.remove('hidden');
        logEvent('Advertencia: Linterna no disponible');
    }
}

// Utilidades
function logEvent(message) {
    const logEntry = document.createElement('li');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    document.getElementById('log-list').appendChild(logEntry);
    console.log(message);
}

// Manejadores de eventos
document.getElementById('capture').addEventListener('click', captureImage);
document.getElementById('discard').addEventListener('click', () => {
    captureElement.style.display = 'none';
    videoElement.style.display = 'block';
    URL.revokeObjectURL(currentCapture);
    currentCapture = null;
});

document.getElementById('close-warning').addEventListener('click', () => {
    document.getElementById('warning-message').classList.add('hidden');
});

// Inicialización y limpieza
document.addEventListener('DOMContentLoaded', initializeCamera);
window.addEventListener('beforeunload', () => {
    cameraStream?.getTracks().forEach(track => {
        track.stop();
        logEvent('Recursos de cámara liberados');
    });
});