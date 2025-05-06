// Variables globales
let stream = null;
let imageCapture = null;
let currentBlobUrl = null;
const video = document.getElementById('video');
const lastImage = document.getElementById('lastImage');
const captureButton = document.getElementById('capture');
const sendButton = document.getElementById('send');
const discardButton = document.getElementById('discard');

// Debugging
function debugLog(message) {
    const now = new Date().toLocaleTimeString();
    const li = document.createElement('li');
    li.textContent = `[${now}] ${message}`;
    document.getElementById('debugList').appendChild(li);
    console.log(message);
}

// Inicialización de cámara
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        video.srcObject = stream;
        imageCapture = new ImageCapture(stream.getVideoTracks()[0]);
        
        video.addEventListener('loadedmetadata', () => {
            updateOverlay();
            checkFlashCapabilities();
            debugLog(`Cámara iniciada - Resolución: ${video.videoWidth}x${video.videoHeight}`);
        });

        window.addEventListener('resize', updateOverlay);
        
    } catch (error) {
        debugLog(`Error de cámara: ${error.message}`);
        alert('Error al acceder a la cámara. Revise los permisos.');
    }
}

// Gestión de overlay
function updateOverlay() {
    const container = document.getElementById('camera-container');
    const overlay = document.querySelector('.green-overlay-video');
    const rect = container.getBoundingClientRect();
    
    const size = Math.min(rect.width, rect.height) * 0.8;
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
    overlay.style.left = `${(rect.width - size) / 2}px`;
    overlay.style.top = `${(rect.height - size) / 2}px`;
    overlay.style.display = 'block';
}

// Captura de foto
captureButton.addEventListener('click', async () => {
    try {
        captureButton.disabled = true;
        debugLog('Iniciando captura...');
        
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        const photoSettings = {
            imageWidth: capabilities.width?.max || 1920,
            imageHeight: capabilities.height?.max || 1080,
            fillLightMode: 'auto'
        };

        // Manejo de iluminación
        if (capabilities.fillLightMode?.includes('flash')) {
            photoSettings.fillLightMode = 'flash';
            debugLog('Flash activado');
        } else if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Captura y actualización
        const blob = await imageCapture.takePhoto(photoSettings);
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        
        currentBlobUrl = URL.createObjectURL(blob);
        lastImage.src = currentBlobUrl;
        lastImage.style.display = 'block';
        video.style.display = 'none';
        
        sendButton.style.display = 'block';
        discardButton.style.display = 'block';
        captureButton.style.display = 'none';
        document.querySelector('.green-overlay-video').style.display = 'none';

        debugLog(`Foto capturada: ${blob.size} bytes`);

    } catch (error) {
        debugLog(`Error en captura: ${error.message}`);
    } finally {
        const track = stream?.getVideoTracks()[0];
        if (track?.getCapabilities().torch) {
            await track.applyConstraints({ advanced: [{ torch: false }] });
        }
        captureButton.disabled = false;
    }
});

// Gestión de estado
function resetUI() {
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }
    
    lastImage.src = '';
    lastImage.style.display = 'none';
    video.style.display = 'block';
    
    sendButton.style.display = 'none';
    discardButton.style.display = 'none';
    captureButton.style.display = 'flex';
    
    document.querySelector('.green-overlay-video').style.display = 'block';
    debugLog('Estado reiniciado');
}

// Envío de imagen
sendButton.addEventListener('click', async () => {
    try {
        if (!currentBlobUrl) return;
        
        debugLog('Convirtiendo imagen...');
        const response = await fetch(currentBlobUrl);
        const blob = await response.blob();
        
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        debugLog('Enviando al servidor...');
        await fetch('TU_ENDPOINT_AQUI', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
        });
        
        debugLog('¡Imagen enviada!');
        resetUI();

    } catch (error) {
        debugLog(`Error en envío: ${error.message}`);
    }
});

// Eventos adicionales
discardButton.addEventListener('click', resetUI);
document.getElementById('close-warning').addEventListener('click', () => {
    document.getElementById('warning-message').classList.add('hidden');
});

// Verificación de hardware
function checkFlashCapabilities() {
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    const warning = document.getElementById('warning-message');
    
    if (!capabilities.fillLightMode && !capabilities.torch) {
        warning.classList.remove('hidden');
        debugLog('Advertencia: Sin soporte para flash/torch');
    }
}

// Inicio
document.addEventListener('DOMContentLoaded', initCamera);
window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
});