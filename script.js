let cameraStream = null;
let captureInterface = null;
let currentCapture = null;
let isTorchActive = false;

const videoElement = document.getElementById('video');
const captureElement = document.getElementById('lastImage');
const overlayElement = document.querySelector('.green-overlay');

// Configuración de cámara
const cameraSettings = {
    resolution: {
        width: { exact: 1920 },
        height: { exact: 1080 },
        aspectRatio: { exact: 16/9 }
    },
    torchConfig: {
        activationDelay: 500,
        deactivationDelay: 300
    }
};

async function initializeCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                ...cameraSettings.resolution
            }
        });
        
        videoElement.srcObject = cameraStream;
        captureInterface = new ImageCapture(cameraStream.getVideoTracks()[0]);
        
        videoElement.addEventListener('loadedmetadata', () => {
            updateOverlayDimensions();
            setupTorchHandler();
        });
        
        window.addEventListener('resize', updateOverlayDimensions);
        
    } catch (error) {
        logEvent(`Error de inicialización: ${error.message}`);
        alert('Error al acceder a la cámara');
    }
}

function updateOverlayDimensions() {
    const container = document.getElementById('camera-container');
    const [width, height] = [container.offsetWidth, container.offsetHeight];
    
    overlayElement.style.width = `${width * 0.9}px`;
    overlayElement.style.height = `${height * 0.9}px`;
    overlayElement.style.left = `${width * 0.05}px`;
    overlayElement.style.top = `${height * 0.05}px`;
}

async function captureImage() {
    let captureTrack;
    try {
        document.getElementById('capture').disabled = true;
        captureTrack = cameraStream.getVideoTracks()[0];
        
        // Activar torch si está disponible
        if (captureTrack.getCapabilities().torch) {
            await captureTrack.applyConstraints({
                advanced: [{ torch: true }]
            });
            await new Promise(r => setTimeout(r, cameraSettings.torchConfig.activationDelay));
            isTorchActive = true;
        }

        // Captura con configuración precisa
        const photo = await captureInterface.takePhoto({
            imageWidth: cameraSettings.resolution.width.exact,
            imageHeight: cameraSettings.resolution.height.exact
        });
        
        // Actualizar vista
        if (currentCapture) URL.revokeObjectURL(currentCapture);
        currentCapture = URL.createObjectURL(photo);
        captureElement.src = currentCapture;
        
        // Transición suave
        videoElement.style.opacity = '0';
        setTimeout(() => {
            videoElement.style.display = 'none';
            captureElement.style.display = 'block';
            videoElement.style.opacity = '1';
        }, 300);
        
    } catch (error) {
        logEvent(`Error en captura: ${error.message}`);
    } finally {
        // Desactivar torch garantizado
        if (captureTrack?.getCapabilities().torch && isTorchActive) {
            await new Promise(r => setTimeout(r, cameraSettings.torchConfig.deactivationDelay));
            await captureTrack.applyConstraints({ advanced: [{ torch: false }] });
            isTorchActive = false;
        }
        document.getElementById('capture').disabled = false;
    }
}

function setupTorchHandler() {
    const track = cameraStream.getVideoTracks()[0];
    const torchSupported = track.getCapabilities().torch;
    
    if (!torchSupported) {
        document.getElementById('warning-message').classList.remove('hidden');
    }
}

// Utilidades
function logEvent(message) {
    const logEntry = document.createElement('li');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    document.getElementById('log-list').appendChild(logEntry);
    console.log(message);
}

// Event handlers
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

// Inicialización
document.addEventListener('DOMContentLoaded', initializeCamera);
window.addEventListener('beforeunload', () => {
    cameraStream?.getTracks().forEach(track => track.stop());
});