const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photo = document.getElementById("photo");
const captureButton = document.getElementById("capture");
let stream;

// Acceder a la cámara trasera sin activar inicialmente el flash
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then((s) => {
    stream = s;
    video.srcObject = stream;
  })
  .catch((error) => console.error("Error al acceder a la cámara:", error));

captureButton.addEventListener("click", async () => {
    // Obtener la pista de video
    const track = stream.getVideoTracks()[0];
    // Consultar las capacidades de la pista
    const capabilities = track.getCapabilities();

    // Si el dispositivo soporta el flash (torch), activar el flash
    if (capabilities.torch) {
        try {
            await track.applyConstraints({ advanced: [{ torch: true }] });
        } catch (e) {
            console.error("Error al activar la linterna:", e);
        }
    }

    // Esperar unos milisegundos para simular el flash (por ejemplo, 100 ms)
    setTimeout(async () => {
        // Capturar la imagen: dibujar el fotograma actual en el canvas
        const context = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        photo.src = canvas.toDataURL("image/png");

        // Apagar el flash si se había activado
        if (capabilities.torch) {
            try {
                await track.applyConstraints({ advanced: [{ torch: false }] });
            } catch (e) {
                console.error("Error al apagar la linterna:", e);
            }
        }
    }, 100); // 100 ms de espera
});
