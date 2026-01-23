// Camera module for webcam integration and color detection
// Uses OpenCV.js (WebAssembly) for image processing

// Reference colors for cube face detection (HSV values for better detection)
var CUBE_FACE_COLORS = {
    white:  { h: [0, 180], s: [0, 30], v: [200, 255], face: 'front' },
    yellow: { h: [20, 35], s: [100, 255], v: [150, 255], face: 'top' },
    red:    { h: [0, 10], s: [100, 255], v: [100, 255], face: 'right', h2: [170, 180] },
    orange: { h: [10, 20], s: [100, 255], v: [150, 255], face: 'left' },
    blue:   { h: [100, 130], s: [100, 255], v: [80, 255], face: 'bottom' },
    green:  { h: [40, 80], s: [50, 255], v: [50, 255], face: 'back' }
};

// OpenCV.js state
var cvState = {
    ready: false,
    loading: false,
    onReadyCallbacks: []
};

var cameraState = {
    stream: null,
    isActive: false,
    isStarting: false,
    video: null,
    canvas: null,
    ctx: null,
    overlay: null,
    placeholder: null,
    controls: null,
    errorEl: null,
    statusEl: null,
    toggleBtn: null,
    snapshotBtn: null,
    detectBtn: null
};

function initCamera() {
    cameraState.video = document.getElementById('camera-video');
    cameraState.canvas = document.getElementById('camera-canvas');
    cameraState.ctx = cameraState.canvas ? cameraState.canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true
    }) : null;
    cameraState.overlay = document.getElementById('camera-overlay');
    cameraState.placeholder = document.getElementById('camera-placeholder');
    cameraState.controls = document.getElementById('camera-controls');
    cameraState.errorEl = document.getElementById('camera-error');
    cameraState.toggleBtn = document.getElementById('camera-toggle');
    cameraState.snapshotBtn = document.getElementById('camera-snapshot');
    cameraState.detectBtn = document.getElementById('camera-detect');
    cameraState.statusEl = document.getElementById('camera-status');

    // Set up event listeners
    if (cameraState.placeholder) {
        cameraState.placeholder.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleCamera();
        });
    }

    if (cameraState.toggleBtn) {
        cameraState.toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleCamera();
        });
    }

    if (cameraState.snapshotBtn) {
        cameraState.snapshotBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            captureSnapshot();
        });
    }

    if (cameraState.detectBtn) {
        cameraState.detectBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            runColorDetection();
        });
    }

    // Initial overlay render
    updateCameraGuide();
}

async function startCamera() {
    if (cameraState.isActive || cameraState.isStarting) return;

    cameraState.isStarting = true;
    hideError();

    try {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 320, max: 640 },
                height: { ideal: 240, max: 480 },
                frameRate: { ideal: 30, max: 30 }
            },
            audio: false
        };

        cameraState.stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Optimize video element for performance
        cameraState.video.srcObject = cameraState.stream;
        cameraState.video.setAttribute('playsinline', '');
        cameraState.video.setAttribute('muted', '');

        await new Promise((resolve, reject) => {
            cameraState.video.onloadedmetadata = () => {
                cameraState.video.play()
                    .then(resolve)
                    .catch(reject);
            };
            cameraState.video.onerror = reject;
        });

        cameraState.isActive = true;

        // Update UI
        cameraState.video.style.display = 'block';
        cameraState.placeholder.style.display = 'none';
        cameraState.toggleBtn.textContent = 'ON';
        cameraState.toggleBtn.classList.add('active');
        cameraState.snapshotBtn.disabled = false;
        if (cameraState.detectBtn) cameraState.detectBtn.disabled = false;

        // Set canvas dimensions to match video
        cameraState.canvas.width = cameraState.video.videoWidth;
        cameraState.canvas.height = cameraState.video.videoHeight;

        // Render overlay guides
        renderOverlayGuides();

        // Start loading OpenCV.js in background for color detection
        initOpenCVOnDemand();

        cameraState.isStarting = false;

    } catch (error) {
        cameraState.isStarting = false;
        handleCameraError(error);
    }
}

function stopCamera() {
    if (!cameraState.isActive) return;

    if (cameraState.stream) {
        cameraState.stream.getTracks().forEach(track => track.stop());
        cameraState.stream = null;
    }

    cameraState.video.srcObject = null;
    cameraState.isActive = false;

    // Update UI
    cameraState.video.style.display = 'none';
    cameraState.placeholder.style.display = 'flex';
    cameraState.toggleBtn.textContent = 'OFF';
    cameraState.toggleBtn.classList.remove('active');
    cameraState.snapshotBtn.disabled = true;
    if (cameraState.detectBtn) cameraState.detectBtn.disabled = true;
    hideStatus();

    // Clear overlay
    if (cameraState.overlay) {
        cameraState.overlay.innerHTML = '';
    }
}

function toggleCamera() {
    if (cameraState.isActive) {
        stopCamera();
    } else {
        startCamera();
    }
}

function captureSnapshot() {
    if (!cameraState.isActive || !cameraState.video || !cameraState.ctx) {
        return null;
    }

    // Draw current video frame to canvas
    cameraState.ctx.drawImage(
        cameraState.video,
        0, 0,
        cameraState.canvas.width,
        cameraState.canvas.height
    );

    // Visual feedback
    cameraState.snapshotBtn.classList.add('flash');
    setTimeout(() => {
        cameraState.snapshotBtn.classList.remove('flash');
    }, 200);

    // Return image data for color detection
    return cameraState.ctx.getImageData(
        0, 0,
        cameraState.canvas.width,
        cameraState.canvas.height
    );
}

function renderOverlayGuides() {
    if (!cameraState.overlay || !cameraState.isActive) return;

    const width = cameraState.video.offsetWidth;
    const height = cameraState.video.offsetHeight;

    cameraState.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);

    let svg = '';

    if (currentPuzzle === 'pyraminx') {
        // Pyraminx triangle guide
        svg = renderPyraminxGuide(width, height);
    } else if (currentPuzzle.startsWith('cube')) {
        // Cube grid guide
        const size = parseInt(currentPuzzle.replace('cube', '')) || 3;
        svg = renderCubeGuide(width, height, size);
    } else if (currentPuzzle === 'cuboid1x2x3') {
        // Cuboid guide (simplified)
        svg = renderCuboidGuide(width, height);
    }

    cameraState.overlay.innerHTML = svg;
}

function renderCubeGuide(width, height, size) {
    const centerX = width / 2;
    const centerY = height / 2;
    const guideSize = Math.min(width, height) * 0.6;
    const cellSize = guideSize / size;
    const startX = centerX - guideSize / 2;
    const startY = centerY - guideSize / 2;

    let svg = '';

    // Center crosshair
    svg += `<line class="guide-center" x1="${centerX - 10}" y1="${centerY}" x2="${centerX + 10}" y2="${centerY}" />`;
    svg += `<line class="guide-center" x1="${centerX}" y1="${centerY - 10}" x2="${centerX}" y2="${centerY + 10}" />`;

    // Grid lines
    for (let i = 0; i <= size; i++) {
        const x = startX + i * cellSize;
        const y = startY + i * cellSize;
        // Vertical lines
        svg += `<line class="guide-line" x1="${x}" y1="${startY}" x2="${x}" y2="${startY + guideSize}" />`;
        // Horizontal lines
        svg += `<line class="guide-line" x1="${startX}" y1="${y}" x2="${startX + guideSize}" y2="${y}" />`;
    }

    // Outer rectangle highlight
    svg += `<rect class="guide-rect" x="${startX}" y="${startY}" width="${guideSize}" height="${guideSize}" />`;

    return svg;
}

function renderPyraminxGuide(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const guideSize = Math.min(width, height) * 0.6;

    // Equilateral triangle points
    const h = guideSize * Math.sqrt(3) / 2;
    const top = { x: centerX, y: centerY - h / 2 };
    const bottomLeft = { x: centerX - guideSize / 2, y: centerY + h / 2 };
    const bottomRight = { x: centerX + guideSize / 2, y: centerY + h / 2 };

    let svg = '';

    // Center crosshair
    svg += `<line class="guide-center" x1="${centerX - 10}" y1="${centerY}" x2="${centerX + 10}" y2="${centerY}" />`;
    svg += `<line class="guide-center" x1="${centerX}" y1="${centerY - 10}" x2="${centerX}" y2="${centerY + 10}" />`;

    // Triangle outline
    svg += `<polygon class="guide-rect" points="${top.x},${top.y} ${bottomLeft.x},${bottomLeft.y} ${bottomRight.x},${bottomRight.y}" />`;

    // Inner division lines (3 layers)
    const midLeft = { x: (top.x + bottomLeft.x) / 2, y: (top.y + bottomLeft.y) / 2 };
    const midRight = { x: (top.x + bottomRight.x) / 2, y: (top.y + bottomRight.y) / 2 };
    const midBottom = { x: centerX, y: bottomLeft.y };

    svg += `<line class="guide-line" x1="${midLeft.x}" y1="${midLeft.y}" x2="${midRight.x}" y2="${midRight.y}" />`;
    svg += `<line class="guide-line" x1="${midLeft.x}" y1="${midLeft.y}" x2="${midBottom.x}" y2="${midBottom.y}" />`;
    svg += `<line class="guide-line" x1="${midRight.x}" y1="${midRight.y}" x2="${midBottom.x}" y2="${midBottom.y}" />`;

    return svg;
}

function renderCuboidGuide(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const guideWidth = Math.min(width, height) * 0.3;
    const guideHeight = guideWidth * 2;

    let svg = '';

    // Center crosshair
    svg += `<line class="guide-center" x1="${centerX - 10}" y1="${centerY}" x2="${centerX + 10}" y2="${centerY}" />`;
    svg += `<line class="guide-center" x1="${centerX}" y1="${centerY - 10}" x2="${centerX}" y2="${centerY + 10}" />`;

    // Rectangle outline
    svg += `<rect class="guide-rect" x="${centerX - guideWidth / 2}" y="${centerY - guideHeight / 2}" width="${guideWidth}" height="${guideHeight}" />`;

    // Horizontal division lines
    const cellHeight = guideHeight / 3;
    for (let i = 1; i < 3; i++) {
        const y = centerY - guideHeight / 2 + i * cellHeight;
        svg += `<line class="guide-line" x1="${centerX - guideWidth / 2}" y1="${y}" x2="${centerX + guideWidth / 2}" y2="${y}" />`;
    }

    return svg;
}

function updateCameraGuide() {
    if (cameraState.isActive) {
        renderOverlayGuides();
    }
}

function handleCameraResize() {
    if (cameraState.isActive) {
        renderOverlayGuides();
    }
}

function handleCameraError(error) {
    let message = 'Camera error';

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message = 'Camera access denied. Please allow camera permissions.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        message = 'Camera is in use by another application.';
    } else if (error.name === 'OverconstrainedError') {
        message = 'Camera constraints could not be satisfied.';
    } else if (error.name === 'NotSupportedError') {
        message = 'Camera is not supported in this browser.';
    } else if (error.name === 'TypeError') {
        message = 'Invalid camera constraints.';
    } else {
        message = error.message || 'Unknown camera error.';
    }

    showError(message);
    console.error('Camera error:', error);
}

function showError(message) {
    if (cameraState.errorEl) {
        cameraState.errorEl.textContent = message;
        cameraState.errorEl.style.display = 'block';
        setTimeout(hideError, 5000);
    }
}

function hideError() {
    if (cameraState.errorEl) {
        cameraState.errorEl.style.display = 'none';
    }
}

function cleanupCamera() {
    stopCamera();
}

// Helper functions for future color detection

function getColorAtPoint(imageData, x, y) {
    const index = (y * imageData.width + x) * 4;
    return {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
        a: imageData.data[index + 3]
    };
}

function getAverageColorInRegion(imageData, x, y, width, height) {
    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;

    for (let py = y; py < y + height && py < imageData.height; py++) {
        for (let px = x; px < x + width && px < imageData.width; px++) {
            const color = getColorAtPoint(imageData, px, py);
            totalR += color.r;
            totalG += color.g;
            totalB += color.b;
            count++;
        }
    }

    if (count === 0) return { r: 0, g: 0, b: 0 };

    return {
        r: Math.round(totalR / count),
        g: Math.round(totalG / count),
        b: Math.round(totalB / count)
    };
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

// Identify cube face color from HSV value
function identifyCubeColor(h, s, v) {
    for (const [colorName, colorData] of Object.entries(CUBE_FACE_COLORS)) {
        // Check if HSV falls within the color's range
        let hMatch = h >= colorData.h[0] && h <= colorData.h[1];
        // Red wraps around, check second hue range
        if (!hMatch && colorData.h2) {
            hMatch = h >= colorData.h2[0] && h <= colorData.h2[1];
        }
        const sMatch = s >= colorData.s[0] && s <= colorData.s[1];
        const vMatch = v >= colorData.v[0] && v <= colorData.v[1];

        if (hMatch && sMatch && vMatch) {
            return { name: colorName, face: colorData.face };
        }
    }
    return null;
}

// ============================================
// OpenCV.js WebAssembly Integration
// ============================================

function loadOpenCV() {
    return new Promise((resolve, reject) => {
        if (cvState.ready) {
            resolve();
            return;
        }

        if (cvState.loading) {
            cvState.onReadyCallbacks.push(resolve);
            return;
        }

        cvState.loading = true;

        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.x/opencv.js';
        script.async = true;

        script.onload = () => {
            // OpenCV.js sets up a Module that calls onRuntimeInitialized when ready
            if (typeof cv !== 'undefined') {
                cv['onRuntimeInitialized'] = () => {
                    cvState.ready = true;
                    cvState.loading = false;
                    console.log('OpenCV.js ready (WebAssembly)');
                    resolve();
                    cvState.onReadyCallbacks.forEach(cb => cb());
                    cvState.onReadyCallbacks = [];
                };
            } else {
                reject(new Error('OpenCV.js failed to load'));
            }
        };

        script.onerror = () => {
            cvState.loading = false;
            reject(new Error('Failed to load OpenCV.js'));
        };

        document.head.appendChild(script);
    });
}

// Process frame with OpenCV for color detection
function processFrameWithOpenCV(imageData) {
    if (!cvState.ready || typeof cv === 'undefined') {
        console.warn('OpenCV not ready');
        return null;
    }

    let src = null;
    let hsv = null;
    let result = null;

    try {
        // Create Mat from ImageData
        src = cv.matFromImageData(imageData);

        // Convert to HSV
        hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        result = {
            width: hsv.cols,
            height: hsv.rows,
            hsv: hsv
        };

    } catch (err) {
        console.error('OpenCV processing error:', err);
        if (src) src.delete();
        if (hsv) hsv.delete();
        return null;
    }

    // Clean up src, keep hsv for caller to use and delete
    if (src) src.delete();

    return result;
}

// Detect colors in grid regions (for cube face detection)
function detectCubeColors(gridSize) {
    if (!cvState.ready || !cameraState.isActive) {
        return null;
    }

    const imageData = captureSnapshot();
    if (!imageData) return null;

    const processed = processFrameWithOpenCV(imageData);
    if (!processed || !processed.hsv) return null;

    const hsv = processed.hsv;
    const colors = [];

    try {
        const cellWidth = Math.floor(hsv.cols / gridSize);
        const cellHeight = Math.floor(hsv.rows / gridSize);
        const margin = Math.floor(Math.min(cellWidth, cellHeight) * 0.2);

        for (let row = 0; row < gridSize; row++) {
            const rowColors = [];
            for (let col = 0; col < gridSize; col++) {
                // Sample center region of each cell
                const x = col * cellWidth + margin;
                const y = row * cellHeight + margin;
                const w = cellWidth - margin * 2;
                const h = cellHeight - margin * 2;

                const avgColor = getAverageHSVInRegion(hsv, x, y, w, h);
                const identified = identifyCubeColor(avgColor.h, avgColor.s, avgColor.v);

                rowColors.push({
                    hsv: avgColor,
                    color: identified ? identified.name : 'unknown',
                    face: identified ? identified.face : null
                });
            }
            colors.push(rowColors);
        }
    } finally {
        hsv.delete();
    }

    return colors;
}

// Get average HSV color in a region of an OpenCV Mat
function getAverageHSVInRegion(hsvMat, x, y, width, height) {
    let totalH = 0, totalS = 0, totalV = 0;
    let count = 0;

    // Clamp bounds
    const maxX = Math.min(x + width, hsvMat.cols);
    const maxY = Math.min(y + height, hsvMat.rows);
    x = Math.max(0, x);
    y = Math.max(0, y);

    for (let py = y; py < maxY; py++) {
        for (let px = x; px < maxX; px++) {
            const idx = (py * hsvMat.cols + px) * 3;
            totalH += hsvMat.data[idx];
            totalS += hsvMat.data[idx + 1];
            totalV += hsvMat.data[idx + 2];
            count++;
        }
    }

    if (count === 0) return { h: 0, s: 0, v: 0 };

    return {
        h: Math.round(totalH / count),
        s: Math.round(totalS / count),
        v: Math.round(totalV / count)
    };
}

// Initialize OpenCV when camera starts (lazy load)
function initOpenCVOnDemand() {
    if (!cvState.ready && !cvState.loading) {
        loadOpenCV().catch(err => {
            console.warn('OpenCV loading deferred:', err.message);
        });
    }
}

// Run color detection and display results
async function runColorDetection() {
    if (!cameraState.isActive) {
        showStatus('Camera not active');
        return;
    }

    // Make sure OpenCV is loaded
    if (!cvState.ready) {
        showStatus('Loading OpenCV...');
        try {
            await loadOpenCV();
        } catch (err) {
            showStatus('Failed to load OpenCV: ' + err.message);
            return;
        }
    }

    showStatus('Detecting colors...');

    // Get grid size based on current puzzle
    let gridSize = 3;
    if (currentPuzzle === 'cube2') gridSize = 2;
    else if (currentPuzzle === 'cube4') gridSize = 4;
    else if (currentPuzzle === 'pyraminx') gridSize = 3;

    const colors = detectCubeColors(gridSize);

    if (!colors) {
        showStatus('Detection failed');
        return;
    }

    // Format results
    let result = 'Detected colors:\n';
    colors.forEach((row, i) => {
        result += row.map(c => c.color.substring(0, 3).toUpperCase()).join(' ') + '\n';
    });

    showStatus(result);

    // Flash detect button
    cameraState.detectBtn.classList.add('flash');
    setTimeout(() => {
        cameraState.detectBtn.classList.remove('flash');
    }, 200);
}

function showStatus(message) {
    if (cameraState.statusEl) {
        cameraState.statusEl.textContent = message;
        cameraState.statusEl.style.display = 'block';
    }
}

function hideStatus() {
    if (cameraState.statusEl) {
        cameraState.statusEl.style.display = 'none';
    }
}
