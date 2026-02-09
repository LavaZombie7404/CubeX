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

// Pyraminx face colors (HSV values for detection - wider ranges for better detection)
var PYRAMINX_FACE_COLORS = {
    red:    { h: [0, 15], s: [80, 255], v: [80, 255], h2: [165, 180], hex: 0xe94560 },
    green:  { h: [35, 90], s: [40, 255], v: [40, 255], hex: 0x4ecca3 },
    blue:   { h: [90, 140], s: [80, 255], v: [60, 255], hex: 0x3498db },
    yellow: { h: [15, 40], s: [80, 255], v: [120, 255], hex: 0xf1c40f }
};

// Pyraminx capture state
var pyraminxCaptureState = {
    isActive: false,
    currentFace: null,
    faceOrder: ['front', 'right', 'left', 'bottom'],
    currentFaceIndex: 0,
    capturedFaces: {},
    previewColors: null
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
    detectBtn: null,
    calibrateBtn: null,
    captureBtn: null,
    captureFlow: null,
    captureInstruction: null,
    colorPreview: null,
    previewAcceptBtn: null,
    previewRetryBtn: null,
    calibrationModal: null
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

    // Pyraminx capture UI elements
    cameraState.calibrateBtn = document.getElementById('camera-calibrate');
    cameraState.captureBtn = document.getElementById('camera-capture');
    cameraState.captureFlow = document.getElementById('capture-flow');
    cameraState.captureInstruction = document.getElementById('capture-instruction');
    cameraState.colorPreview = document.getElementById('color-preview');
    cameraState.previewAcceptBtn = document.getElementById('preview-accept');
    cameraState.previewRetryBtn = document.getElementById('preview-retry');
    cameraState.calibrationModal = document.getElementById('calibration-modal');

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
            if (pyraminxCaptureState.isActive) {
                capturePyraminxFace();
            } else {
                captureSnapshot();
            }
        });
    }

    if (cameraState.detectBtn) {
        cameraState.detectBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            runColorDetection();
        });
    }

    // Pyraminx capture button handlers
    if (cameraState.captureBtn) {
        cameraState.captureBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            startPyraminxCapture();
        });
    }

    if (cameraState.calibrateBtn) {
        cameraState.calibrateBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showCalibrationModal();
        });
    }

    if (cameraState.previewAcceptBtn) {
        cameraState.previewAcceptBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            confirmFaceCapture();
        });
    }

    if (cameraState.previewRetryBtn) {
        cameraState.previewRetryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            retryFaceCapture();
        });
    }

    // Calibration modal handlers
    var calSampleBtn = document.getElementById('cal-sample');
    var calResetBtn = document.getElementById('cal-reset');
    var calCloseBtn = document.getElementById('cal-close');

    if (calSampleBtn) {
        calSampleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            calibrateSelectedColor();
        });
    }

    if (calResetBtn) {
        calResetBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            resetCalibration();
        });
    }

    if (calCloseBtn) {
        calCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideCalibrationModal();
        });
    }

    // Load saved calibration
    loadCalibration();

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
        if (cameraState.calibrateBtn) cameraState.calibrateBtn.disabled = false;
        if (cameraState.captureBtn) cameraState.captureBtn.disabled = false;

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
    if (cameraState.calibrateBtn) cameraState.calibrateBtn.disabled = true;
    if (cameraState.captureBtn) cameraState.captureBtn.disabled = true;
    hideStatus();

    // Reset pyraminx capture state
    cancelPyraminxCapture();

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
    const regions = getPyraminxTriangleRegions(width, height);
    let svg = '';

    const centerX = width / 2;
    const centerY = height / 2;

    // Center crosshair
    svg += `<line class="guide-center" x1="${centerX - 10}" y1="${centerY}" x2="${centerX + 10}" y2="${centerY}" />`;
    svg += `<line class="guide-center" x1="${centerX}" y1="${centerY - 10}" x2="${centerX}" y2="${centerY + 10}" />`;

    // Draw each triangle region
    regions.forEach((tri, idx) => {
        const points = tri.vertices.map(v => `${v.x},${v.y}`).join(' ');
        const isUpward = tri.upward;

        // Triangle outline
        svg += `<polygon class="guide-triangle ${isUpward ? 'upward' : 'downward'}" points="${points}" />`;

        // Calculate centroid for number label
        const cx = (tri.vertices[0].x + tri.vertices[1].x + tri.vertices[2].x) / 3;
        const cy = (tri.vertices[0].y + tri.vertices[1].y + tri.vertices[2].y) / 3;

        // Number label
        svg += `<text class="guide-number" x="${cx}" y="${cy + 4}">${idx}</text>`;
    });

    return svg;
}

// Calculate 9 triangle regions for Pyraminx face
// Layout (3 divisions):
//        /\           <- Index 0 (tip, row 0)
//       /--\
//      /\  /\         <- Indices 1, 2, 3 (row 1: up, DOWN, up)
//     /--\/--\
//    /\  /\  /\       <- Indices 4, 5, 6, 7, 8 (row 2: up, DOWN, up, DOWN, up)
//   /__\/__\/__\
function getPyraminxTriangleRegions(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const guideSize = Math.min(width, height) * 0.6;

    // Equilateral triangle height
    const h = guideSize * Math.sqrt(3) / 2;

    // Main triangle vertices
    const top = { x: centerX, y: centerY - h / 2 };
    const bottomLeft = { x: centerX - guideSize / 2, y: centerY + h / 2 };
    const bottomRight = { x: centerX + guideSize / 2, y: centerY + h / 2 };

    // Helper: linear interpolation
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    // Create a grid of points for 3-division subdivision
    // Points along left edge (top to bottomLeft)
    const L0 = top;
    const L1 = lerp(top, bottomLeft, 1/3);
    const L2 = lerp(top, bottomLeft, 2/3);
    const L3 = bottomLeft;

    // Points along right edge (top to bottomRight)
    const R0 = top;
    const R1 = lerp(top, bottomRight, 1/3);
    const R2 = lerp(top, bottomRight, 2/3);
    const R3 = bottomRight;

    // Points along bottom edge (bottomLeft to bottomRight)
    const B0 = bottomLeft;
    const B1 = lerp(bottomLeft, bottomRight, 1/3);
    const B2 = lerp(bottomLeft, bottomRight, 2/3);
    const B3 = bottomRight;

    // Interior points at row 1 (1/3 down)
    const M1_0 = lerp(L1, R1, 0);      // = L1
    const M1_1 = lerp(L1, R1, 1);      // = R1

    // Interior points at row 2 (2/3 down)
    const M2_0 = lerp(L2, R2, 0);      // = L2
    const M2_1 = lerp(L2, R2, 0.5);    // middle of row 2
    const M2_2 = lerp(L2, R2, 1);      // = R2

    const regions = [];

    // Row 0: 1 upward triangle (tip)
    regions.push({
        vertices: [L0, L1, R1],
        upward: true,
        row: 0,
        col: 0
    });

    // Row 1: 3 triangles (up, down, up)
    // Index 1: upward left
    regions.push({
        vertices: [L1, L2, M2_1],
        upward: true,
        row: 1,
        col: 0
    });
    // Index 2: downward center (inverted)
    regions.push({
        vertices: [L1, R1, M2_1],
        upward: false,
        row: 1,
        col: 1
    });
    // Index 3: upward right
    regions.push({
        vertices: [R1, M2_1, R2],
        upward: true,
        row: 1,
        col: 2
    });

    // Row 2: 5 triangles (up, down, up, down, up)
    // Index 4: upward far left
    regions.push({
        vertices: [L2, L3, B1],
        upward: true,
        row: 2,
        col: 0
    });
    // Index 5: downward left-center
    regions.push({
        vertices: [L2, B1, M2_1],
        upward: false,
        row: 2,
        col: 1
    });
    // Index 6: upward center
    regions.push({
        vertices: [M2_1, B1, B2],
        upward: true,
        row: 2,
        col: 2
    });
    // Index 7: downward right-center
    regions.push({
        vertices: [M2_1, B2, R2],
        upward: false,
        row: 2,
        col: 3
    });
    // Index 8: upward far right
    regions.push({
        vertices: [R2, B2, R3],
        upward: true,
        row: 2,
        col: 4
    });

    return regions;
}

// Check if a point is inside a triangle using barycentric coordinates
function isPointInTriangle(px, py, v0, v1, v2) {
    const dX = px - v2.x;
    const dY = py - v2.y;
    const dX21 = v2.x - v1.x;
    const dY12 = v1.y - v2.y;
    const D = dY12 * (v0.x - v2.x) + dX21 * (v0.y - v2.y);
    const s = dY12 * dX + dX21 * dY;
    const t = (v2.y - v0.y) * dX + (v0.x - v2.x) * dY;

    if (D < 0) return s <= 0 && t <= 0 && s + t >= D;
    return s >= 0 && t >= 0 && s + t <= D;
}

// Get average HSV color inside a triangle from OpenCV HSV Mat
function getAverageHSVInTriangle(hsvMat, vertices) {
    // Get bounding box
    const minX = Math.max(0, Math.floor(Math.min(vertices[0].x, vertices[1].x, vertices[2].x)));
    const maxX = Math.min(hsvMat.cols - 1, Math.ceil(Math.max(vertices[0].x, vertices[1].x, vertices[2].x)));
    const minY = Math.max(0, Math.floor(Math.min(vertices[0].y, vertices[1].y, vertices[2].y)));
    const maxY = Math.min(hsvMat.rows - 1, Math.ceil(Math.max(vertices[0].y, vertices[1].y, vertices[2].y)));

    let totalH = 0, totalS = 0, totalV = 0;
    let count = 0;

    // Sample pixels inside triangle with some margin
    const margin = 0.15;
    const cx = (vertices[0].x + vertices[1].x + vertices[2].x) / 3;
    const cy = (vertices[0].y + vertices[1].y + vertices[2].y) / 3;

    // Shrink triangle toward center for better sampling
    const shrunkVertices = vertices.map(v => ({
        x: v.x + (cx - v.x) * margin,
        y: v.y + (cy - v.y) * margin
    }));

    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            if (isPointInTriangle(px, py, shrunkVertices[0], shrunkVertices[1], shrunkVertices[2])) {
                const idx = (py * hsvMat.cols + px) * 3;
                totalH += hsvMat.data[idx];
                totalS += hsvMat.data[idx + 1];
                totalV += hsvMat.data[idx + 2];
                count++;
            }
        }
    }

    if (count === 0) return { h: 0, s: 0, v: 0 };

    return {
        h: Math.round(totalH / count),
        s: Math.round(totalS / count),
        v: Math.round(totalV / count)
    };
}

// Identify Pyraminx color from HSV values
function identifyPyraminxColor(h, s, v) {
    let bestMatch = null;
    let bestScore = -1;

    for (const [colorName, colorData] of Object.entries(PYRAMINX_FACE_COLORS)) {
        // Check if HSV falls within the color's range
        let hMatch = h >= colorData.h[0] && h <= colorData.h[1];
        // Red wraps around, check second hue range
        if (!hMatch && colorData.h2) {
            hMatch = h >= colorData.h2[0] && h <= colorData.h2[1];
        }
        const sMatch = s >= colorData.s[0] && s <= colorData.s[1];
        const vMatch = v >= colorData.v[0] && v <= colorData.v[1];

        if (hMatch && sMatch && vMatch) {
            // Calculate match score (how centered in the range)
            const hCenter = (colorData.h[0] + colorData.h[1]) / 2;
            const sCenter = (colorData.s[0] + colorData.s[1]) / 2;
            const vCenter = (colorData.v[0] + colorData.v[1]) / 2;
            const score = 100 - (Math.abs(h - hCenter) + Math.abs(s - sCenter) * 0.5 + Math.abs(v - vCenter) * 0.5);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = { name: colorName, hex: colorData.hex };
            }
        }
    }

    return bestMatch;
}

// Detect colors in 9 triangular regions for Pyraminx
function detectPyraminxColors() {
    if (!cvState.ready || !cameraState.isActive) {
        return null;
    }

    const imageData = captureSnapshot();
    if (!imageData) return null;

    const processed = processFrameWithOpenCV(imageData);
    if (!processed || !processed.hsv) return null;

    const hsv = processed.hsv;

    // Get video display dimensions (what user sees)
    const displayWidth = cameraState.video.offsetWidth;
    const displayHeight = cameraState.video.offsetHeight;

    // Get actual video dimensions
    const videoWidth = hsv.cols;
    const videoHeight = hsv.rows;

    // Calculate scale factors
    const scaleX = videoWidth / displayWidth;
    const scaleY = videoHeight / displayHeight;

    // Get triangle regions in display coordinates
    const displayRegions = getPyraminxTriangleRegions(displayWidth, displayHeight);

    // Scale regions to video coordinates
    const videoRegions = displayRegions.map(region => ({
        ...region,
        vertices: region.vertices.map(v => ({
            x: v.x * scaleX,
            y: v.y * scaleY
        }))
    }));

    const colors = [];

    try {
        videoRegions.forEach((region, idx) => {
            const avgColor = getAverageHSVInTriangle(hsv, region.vertices);
            const identified = identifyPyraminxColor(avgColor.h, avgColor.s, avgColor.v);

            colors.push({
                index: idx,
                hsv: avgColor,
                color: identified ? identified.name : 'unknown',
                hex: identified ? identified.hex : 0x808080,
                row: region.row,
                col: region.col,
                upward: region.upward
            });
        });
    } finally {
        hsv.delete();
    }

    return colors;
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

// ============================================
// Pyraminx Capture Flow
// ============================================

// Start multi-face capture flow
async function startPyraminxCapture() {
    if (currentPuzzle !== 'pyraminx') {
        showStatus('Select Pyraminx puzzle first');
        return;
    }

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

    // Reset capture state
    pyraminxCaptureState.isActive = true;
    pyraminxCaptureState.currentFaceIndex = 0;
    pyraminxCaptureState.capturedFaces = {};
    pyraminxCaptureState.previewColors = null;
    pyraminxCaptureState.currentFace = pyraminxCaptureState.faceOrder[0];

    // Show capture UI
    if (cameraState.captureFlow) {
        cameraState.captureFlow.style.display = 'block';
    }
    if (cameraState.colorPreview) {
        cameraState.colorPreview.style.display = 'none';
    }

    // Update progress indicators
    updateCaptureProgress();
    updateCaptureInstruction();

    // Change SNAP button text
    if (cameraState.snapshotBtn) {
        cameraState.snapshotBtn.textContent = 'SNAP';
    }

    // Disable capture button during flow
    if (cameraState.captureBtn) {
        cameraState.captureBtn.disabled = true;
    }

    hideStatus();
}

// Cancel capture flow
function cancelPyraminxCapture() {
    pyraminxCaptureState.isActive = false;
    pyraminxCaptureState.currentFaceIndex = 0;
    pyraminxCaptureState.capturedFaces = {};
    pyraminxCaptureState.previewColors = null;
    pyraminxCaptureState.currentFace = null;

    // Hide capture UI
    if (cameraState.captureFlow) {
        cameraState.captureFlow.style.display = 'none';
    }
    if (cameraState.colorPreview) {
        cameraState.colorPreview.style.display = 'none';
    }

    // Restore SNAP button
    if (cameraState.snapshotBtn) {
        cameraState.snapshotBtn.textContent = 'SNAP';
    }

    // Re-enable capture button
    if (cameraState.captureBtn && cameraState.isActive) {
        cameraState.captureBtn.disabled = false;
    }
}

// Capture and detect current face
function capturePyraminxFace() {
    if (!pyraminxCaptureState.isActive) {
        captureSnapshot();
        return;
    }

    const colors = detectPyraminxColors();
    if (!colors) {
        showStatus('Detection failed - try again');
        return;
    }

    pyraminxCaptureState.previewColors = colors;

    // Show preview with detected colors
    showColorPreview(colors);

    // Flash effect
    if (cameraState.snapshotBtn) {
        cameraState.snapshotBtn.classList.add('flash');
        setTimeout(() => {
            cameraState.snapshotBtn.classList.remove('flash');
        }, 200);
    }
}

// Show color preview overlay
function showColorPreview(colors) {
    if (!cameraState.colorPreview) return;

    const previewSvg = document.getElementById('preview-triangles');
    if (!previewSvg) return;

    const width = cameraState.video.offsetWidth;
    const height = cameraState.video.offsetHeight;

    previewSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const regions = getPyraminxTriangleRegions(width, height);
    let svg = '';

    regions.forEach((region, idx) => {
        const color = colors[idx];
        const hexColor = '#' + color.hex.toString(16).padStart(6, '0');
        const points = region.vertices.map(v => `${v.x},${v.y}`).join(' ');

        svg += `<polygon class="preview-triangle" points="${points}" fill="${hexColor}" stroke="white" stroke-width="2" />`;

        // Add color label
        const cx = (region.vertices[0].x + region.vertices[1].x + region.vertices[2].x) / 3;
        const cy = (region.vertices[0].y + region.vertices[1].y + region.vertices[2].y) / 3;
        svg += `<text class="preview-label" x="${cx}" y="${cy + 4}">${color.color.substring(0, 1).toUpperCase()}</text>`;
    });

    previewSvg.innerHTML = svg;
    cameraState.colorPreview.style.display = 'flex';
}

// Confirm face capture and move to next
function confirmFaceCapture() {
    if (!pyraminxCaptureState.isActive || !pyraminxCaptureState.previewColors) return;

    // Store captured face
    const faceName = pyraminxCaptureState.currentFace;
    pyraminxCaptureState.capturedFaces[faceName] = pyraminxCaptureState.previewColors;
    pyraminxCaptureState.previewColors = null;

    // Hide preview
    if (cameraState.colorPreview) {
        cameraState.colorPreview.style.display = 'none';
    }

    // Move to next face
    pyraminxCaptureState.currentFaceIndex++;

    if (pyraminxCaptureState.currentFaceIndex >= pyraminxCaptureState.faceOrder.length) {
        // All faces captured - apply colors
        finishPyraminxCapture();
    } else {
        // Update to next face
        pyraminxCaptureState.currentFace = pyraminxCaptureState.faceOrder[pyraminxCaptureState.currentFaceIndex];
        updateCaptureProgress();
        updateCaptureInstruction();
    }
}

// Retry current face capture
function retryFaceCapture() {
    pyraminxCaptureState.previewColors = null;

    // Hide preview
    if (cameraState.colorPreview) {
        cameraState.colorPreview.style.display = 'none';
    }

    updateCaptureInstruction();
}

// Update capture progress indicators
function updateCaptureProgress() {
    const indicators = document.querySelectorAll('.face-indicator');
    indicators.forEach((indicator, idx) => {
        const face = indicator.dataset.face;
        const faceIdx = pyraminxCaptureState.faceOrder.indexOf(face);

        indicator.classList.remove('pending', 'active', 'captured');

        if (faceIdx < pyraminxCaptureState.currentFaceIndex) {
            indicator.classList.add('captured');
        } else if (faceIdx === pyraminxCaptureState.currentFaceIndex) {
            indicator.classList.add('active');
        } else {
            indicator.classList.add('pending');
        }
    });
}

// Update capture instruction text
function updateCaptureInstruction() {
    if (!cameraState.captureInstruction) return;

    const faceName = pyraminxCaptureState.currentFace;
    const faceNames = {
        front: 'Front',
        right: 'Right',
        left: 'Left',
        bottom: 'Bottom'
    };

    cameraState.captureInstruction.textContent = `Position ${faceNames[faceName] || faceName} face, then click SNAP`;
}

// Finish capture and apply colors to model
function finishPyraminxCapture() {
    applyPyraminxColors();
    cancelPyraminxCapture();
    showStatus('Colors applied to Pyraminx');

    // Flash capture button
    if (cameraState.captureBtn) {
        cameraState.captureBtn.classList.add('flash');
        setTimeout(() => {
            cameraState.captureBtn.classList.remove('flash');
        }, 200);
    }
}

// Apply captured colors to 3D model
function applyPyraminxColors() {
    if (typeof pyraminxState === 'undefined' || !pyraminxState.pieces || pyraminxState.pieces.length === 0) {
        console.warn('Pyraminx model not available');
        return;
    }

    const faceMap = {
        front: 'front',
        right: 'right',
        left: 'left',
        bottom: 'bottom'
    };

    // Map captured colors to model faces
    for (const [captureFace, colors] of Object.entries(pyraminxCaptureState.capturedFaces)) {
        const modelFace = faceMap[captureFace];
        if (!modelFace) continue;

        // Apply colors to the face's triangles
        colors.forEach((colorData, idx) => {
            applyColorToTriangle(modelFace, idx, colorData.hex);
        });
    }

    // Update the diagram
    if (typeof updatePyraminxDiagram === 'function') {
        updatePyraminxDiagram();
    }
}

// Apply color to a specific triangle on the model
function applyColorToTriangle(face, index, hexColor) {
    if (!pyraminxState || !pyraminxState.pieces) return;

    // Find the piece with matching face and index
    pyraminxState.pieces.forEach(piece => {
        if (piece.userData && piece.userData.face === face && piece.userData.index === index) {
            // Update the material color
            if (piece.material) {
                piece.material.color.setHex(hexColor);
            }
        }
    });
}

// ============================================
// Color Calibration
// ============================================

var calibrationState = {
    selectedColor: null
};

function showCalibrationModal() {
    if (!cameraState.calibrationModal) return;

    // Build color buttons
    const colorsContainer = document.getElementById('cal-colors');
    if (colorsContainer) {
        let html = '';
        for (const [colorName, colorData] of Object.entries(PYRAMINX_FACE_COLORS)) {
            const hexColor = '#' + colorData.hex.toString(16).padStart(6, '0');
            html += `<button class="cal-color" data-color="${colorName}" style="background-color: ${hexColor}">${colorName}</button>`;
        }
        colorsContainer.innerHTML = html;

        // Add click handlers
        colorsContainer.querySelectorAll('.cal-color').forEach(btn => {
            btn.addEventListener('click', function() {
                selectCalibrationColor(this.dataset.color);
            });
        });
    }

    calibrationState.selectedColor = null;
    cameraState.calibrationModal.style.display = 'flex';
}

function hideCalibrationModal() {
    if (!cameraState.calibrationModal) return;

    cameraState.calibrationModal.style.display = 'none';
    saveCalibration();
}

function selectCalibrationColor(colorName) {
    calibrationState.selectedColor = colorName;

    // Update UI
    document.querySelectorAll('.cal-color').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === colorName);
    });
}

function calibrateSelectedColor() {
    if (!calibrationState.selectedColor) {
        showStatus('Select a color first');
        return;
    }

    if (!cvState.ready || !cameraState.isActive) {
        showStatus('Camera/OpenCV not ready');
        return;
    }

    // Capture center region HSV
    const imageData = captureSnapshot();
    if (!imageData) return;

    const processed = processFrameWithOpenCV(imageData);
    if (!processed || !processed.hsv) return;

    const hsv = processed.hsv;

    try {
        // Sample center region
        const centerX = Math.floor(hsv.cols / 2);
        const centerY = Math.floor(hsv.rows / 2);
        const sampleSize = 30;

        const avgColor = getAverageHSVInRegion(hsv,
            centerX - sampleSize / 2,
            centerY - sampleSize / 2,
            sampleSize, sampleSize);

        // Update color ranges with tolerance
        const tolerance = { h: 15, s: 40, v: 40 };
        const colorData = PYRAMINX_FACE_COLORS[calibrationState.selectedColor];

        if (colorData) {
            colorData.h = [
                Math.max(0, avgColor.h - tolerance.h),
                Math.min(180, avgColor.h + tolerance.h)
            ];
            colorData.s = [
                Math.max(0, avgColor.s - tolerance.s),
                Math.min(255, avgColor.s + tolerance.s)
            ];
            colorData.v = [
                Math.max(0, avgColor.v - tolerance.v),
                Math.min(255, avgColor.v + tolerance.v)
            ];

            // Handle red wraparound
            if (calibrationState.selectedColor === 'red') {
                if (avgColor.h < 10) {
                    colorData.h2 = [170, 180];
                } else if (avgColor.h > 170) {
                    colorData.h = [0, 10];
                    colorData.h2 = [Math.max(170, avgColor.h - tolerance.h), 180];
                }
            }

            showStatus(`Calibrated ${calibrationState.selectedColor}: H=${avgColor.h} S=${avgColor.s} V=${avgColor.v}`);
        }
    } finally {
        hsv.delete();
    }
}

function resetCalibration() {
    // Reset to defaults (wider ranges for better detection)
    PYRAMINX_FACE_COLORS.red = { h: [0, 15], s: [80, 255], v: [80, 255], h2: [165, 180], hex: 0xe94560 };
    PYRAMINX_FACE_COLORS.green = { h: [35, 90], s: [40, 255], v: [40, 255], hex: 0x4ecca3 };
    PYRAMINX_FACE_COLORS.blue = { h: [90, 140], s: [80, 255], v: [60, 255], hex: 0x3498db };
    PYRAMINX_FACE_COLORS.yellow = { h: [15, 40], s: [80, 255], v: [120, 255], hex: 0xf1c40f };

    // Clear localStorage
    localStorage.removeItem('pyraminxColorCalibration');

    showStatus('Calibration reset to defaults');
}

function saveCalibration() {
    const calibration = {};
    for (const [colorName, colorData] of Object.entries(PYRAMINX_FACE_COLORS)) {
        calibration[colorName] = {
            h: colorData.h,
            s: colorData.s,
            v: colorData.v,
            h2: colorData.h2
        };
    }
    localStorage.setItem('pyraminxColorCalibration', JSON.stringify(calibration));
}

function loadCalibration() {
    try {
        const saved = localStorage.getItem('pyraminxColorCalibration');
        if (saved) {
            const calibration = JSON.parse(saved);
            for (const [colorName, ranges] of Object.entries(calibration)) {
                if (PYRAMINX_FACE_COLORS[colorName]) {
                    PYRAMINX_FACE_COLORS[colorName].h = ranges.h;
                    PYRAMINX_FACE_COLORS[colorName].s = ranges.s;
                    PYRAMINX_FACE_COLORS[colorName].v = ranges.v;
                    if (ranges.h2) {
                        PYRAMINX_FACE_COLORS[colorName].h2 = ranges.h2;
                    }
                }
            }
            console.log('Loaded color calibration from localStorage');
        }
    } catch (err) {
        console.warn('Failed to load color calibration:', err);
    }
}
