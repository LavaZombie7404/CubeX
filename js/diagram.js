// Diagram system - supports cube and pyraminx with net and circular views
var diagramState = {
    svg: null,
    size: 3,
    cellSize: 25,
    gap: 2,
    view: 'net',
    puzzleType: 'cube',  // 'cube' or 'pyraminx'
    initialized: false,
    colors: {
        top: '#ffff00',
        bottom: '#0000ff',
        front: '#ffffff',
        back: '#00ff00',
        right: '#ff0000',
        left: '#ffa500'
    },
    faces: {}
};

function clearDiagram() {
    const container = document.getElementById('cube-diagram');
    if (container) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No diagram for this puzzle</p>';
    }
    diagramState.puzzleType = 'none';
}

function initDiagram(size) {
    size = size || 3;
    diagramState.size = size;
    diagramState.cellSize = size === 2 ? 35 : 25;
    diagramState.puzzleType = 'cube';

    // Initialize face states with solved colors
    diagramState.faces = {
        top: createFaceState('top', size),
        bottom: createFaceState('bottom', size),
        front: createFaceState('front', size),
        back: createFaceState('back', size),
        left: createFaceState('left', size),
        right: createFaceState('right', size)
    };

    // Setup view switcher only once
    if (!diagramState.initialized) {
        setupViewSwitcher();
        diagramState.initialized = true;
    }

    // Reset to net view on puzzle change
    diagramState.view = 'net';
    resetViewButtons();

    renderCurrentView();
}

function resetViewButtons() {
    const buttons = document.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === 'net') {
            btn.classList.add('active');
        }
    });
}

function createFaceState(face, size) {
    const state = [];
    for (let row = 0; row < size; row++) {
        state[row] = [];
        for (let col = 0; col < size; col++) {
            state[row][col] = diagramState.colors[face];
        }
    }
    return state;
}

function setupViewSwitcher() {
    const buttons = document.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            diagramState.view = this.dataset.view;
            renderCurrentView();
        });
    });
}

function renderCurrentView() {
    if (diagramState.puzzleType === 'none') {
        // No diagram for this puzzle (e.g., cuboids)
        clearDiagram();
        return;
    } else if (diagramState.puzzleType === 'pyraminx') {
        // Pyraminx only has circular view for now
        renderPyraminxDiagram();
    } else {
        // Cube views
        if (diagramState.view === 'net') {
            renderNetDiagram();
        } else if (diagramState.view === 'circular') {
            renderCircularDiagram();
        }
    }
}

// ============ NET DIAGRAM ============
function renderNetDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '';

    const size = diagramState.size;
    const cell = diagramState.cellSize;
    const gap = diagramState.gap;
    const faceSize = size * (cell + gap);

    const svgWidth = faceSize * 4 + gap * 3;
    const svgHeight = faceSize * 3 + gap * 2;

    const svg = d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    diagramState.svg = svg;

    const facePositions = {
        top:    { x: faceSize + gap, y: 0 },
        left:   { x: 0, y: faceSize + gap },
        front:  { x: faceSize + gap, y: faceSize + gap },
        right:  { x: (faceSize + gap) * 2, y: faceSize + gap },
        back:   { x: (faceSize + gap) * 3, y: faceSize + gap },
        bottom: { x: faceSize + gap, y: (faceSize + gap) * 2 }
    };

    Object.keys(facePositions).forEach(face => {
        renderNetFace(svg, face, facePositions[face].x, facePositions[face].y);
    });
}

function renderNetFace(svg, faceName, offsetX, offsetY) {
    const size = diagramState.size;
    const cell = diagramState.cellSize;
    const gap = diagramState.gap;
    const faceState = diagramState.faces[faceName];

    const faceGroup = svg.append('g')
        .attr('class', `face face-${faceName}`)
        .attr('transform', `translate(${offsetX}, ${offsetY})`);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            faceGroup.append('rect')
                .attr('x', col * (cell + gap))
                .attr('y', row * (cell + gap))
                .attr('width', cell)
                .attr('height', cell)
                .attr('fill', faceState[row][col])
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('rx', 2);
        }
    }
}

// ============ CIRCULAR DIAGRAM (Concentric Circles) ============
// 3 groups of concentric circles at 120° angles
// Dots positioned at actual circle-circle intersections

var circularState = {
    dotElements: {},
    groupCenters: [],
    radii: [],
    svgSize: 450,
    cx: 225,
    cy: 225,
    activeTimers: [],
    lastRotationClockwise: true
};

function renderCircularDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '';
    circularState.dotElements = {};

    const size = diagramState.size;
    const svgSize = 450;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const dotRadius = size === 2 ? 8 : 6;

    // Store for animation calculations
    circularState.svgSize = svgSize;
    circularState.cx = cx;
    circularState.cy = cy;
    circularState.dotRadius = dotRadius;

    const svg = d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    // 3 circle group centers at 120° angles - smaller triangle
    const groupDistance = svgSize * 0.12;  // Reduced from 0.22
    const groupCenters = [
        { x: cx, y: cy - groupDistance },                                    // Top (Group A)
        { x: cx - groupDistance * 0.866, y: cy + groupDistance * 0.5 },      // Bottom-left (Group B)
        { x: cx + groupDistance * 0.866, y: cy + groupDistance * 0.5 }       // Bottom-right (Group C)
    ];
    circularState.groupCenters = groupCenters;

    // Circle radii - larger to ensure proper intersections
    const baseRadius = svgSize * 0.18;
    const radiusStep = svgSize * 0.055;
    const radii = [];
    for (let i = 0; i < size; i++) {
        radii.push(baseRadius + i * radiusStep);
    }
    circularState.radii = radii;

    // Draw the 3 groups of concentric circles
    const circlesGroup = svg.append('g').attr('class', 'circular-circles');

    groupCenters.forEach((center, groupIdx) => {
        radii.forEach((radius, layerIdx) => {
            circlesGroup.append('circle')
                .attr('cx', center.x)
                .attr('cy', center.y)
                .attr('r', radius)
                .attr('fill', 'none')
                .attr('stroke', '#555')
                .attr('stroke-width', 1);
        });
    });

    // Calculate intersection points for each face
    const faceConfigs = calculateCircleIntersections(groupCenters, radii, size, cx, cy);

    // Draw connecting lines between adjacent dots
    const linesGroup = svg.append('g').attr('class', 'circular-lines');
    drawCircularConnections(linesGroup, faceConfigs, size);

    // Draw dots at intersection points
    const dotsGroup = svg.append('g').attr('class', 'circular-dots');
    drawCircularDots(dotsGroup, faceConfigs, size, dotRadius);
}

// Calculate actual circle-circle intersection points
function circleIntersection(c1x, c1y, r1, c2x, c2y, r2) {
    const dx = c2x - c1x;
    const dy = c2y - c1y;
    const d = Math.sqrt(dx * dx + dy * dy);

    // Check if circles intersect
    if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
        return null;
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);

    const px = c1x + (a * dx) / d;
    const py = c1y + (a * dy) / d;

    // Two intersection points
    return [
        { x: px + (h * dy) / d, y: py - (h * dx) / d },
        { x: px - (h * dy) / d, y: py + (h * dx) / d }
    ];
}

function calculateCircleIntersections(groupCenters, radii, size, cx, cy) {
    // Face mapping: which two groups intersect and which intersection point to use
    const faceMap = [
        { name: 'right', g1: 0, g2: 1, pickClosestTo: { x: cx + 100, y: cy - 50 } },
        { name: 'front', g1: 0, g2: 2, pickClosestTo: { x: cx - 100, y: cy - 50 } },
        { name: 'top', g1: 1, g2: 2, pickClosestTo: { x: cx, y: cy - 100 } },
        { name: 'left', g1: 0, g2: 1, pickClosestTo: { x: cx - 100, y: cy + 50 } },
        { name: 'back', g1: 0, g2: 2, pickClosestTo: { x: cx + 100, y: cy + 50 } },
        { name: 'bottom', g1: 1, g2: 2, pickClosestTo: { x: cx, y: cy + 100 } }
    ];

    const faceConfigs = {};

    faceMap.forEach(face => {
        const faceState = diagramState.faces[face.name];
        const c1 = groupCenters[face.g1];
        const c2 = groupCenters[face.g2];

        faceConfigs[face.name] = { dots: [] };

        for (let row = 0; row < size; row++) {
            faceConfigs[face.name].dots[row] = [];
            for (let col = 0; col < size; col++) {
                const r1 = radii[row];
                const r2 = radii[col];

                const intersections = circleIntersection(c1.x, c1.y, r1, c2.x, c2.y, r2);

                let point = { x: cx, y: cy }; // fallback

                if (intersections) {
                    // Pick the intersection point closest to the target area
                    const d1 = Math.hypot(intersections[0].x - face.pickClosestTo.x, intersections[0].y - face.pickClosestTo.y);
                    const d2 = Math.hypot(intersections[1].x - face.pickClosestTo.x, intersections[1].y - face.pickClosestTo.y);
                    point = d1 < d2 ? intersections[0] : intersections[1];
                }

                faceConfigs[face.name].dots[row][col] = {
                    x: point.x,
                    y: point.y,
                    color: faceState[row][col],
                    face: face.name,
                    row: row,
                    col: col,
                    circleGroup1: face.g1,
                    circleGroup2: face.g2,
                    radius1: r1,
                    radius2: r2
                };
            }
        }
    });

    return faceConfigs;
}

function drawCircularConnections(linesGroup, faceConfigs, size) {
    Object.keys(faceConfigs).forEach(faceName => {
        const dots = faceConfigs[faceName].dots;

        // Horizontal connections
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size - 1; col++) {
                linesGroup.append('line')
                    .attr('x1', dots[row][col].x)
                    .attr('y1', dots[row][col].y)
                    .attr('x2', dots[row][col + 1].x)
                    .attr('y2', dots[row][col + 1].y)
                    .attr('stroke', '#444')
                    .attr('stroke-width', 1);
            }
        }

        // Vertical connections
        for (let row = 0; row < size - 1; row++) {
            for (let col = 0; col < size; col++) {
                linesGroup.append('line')
                    .attr('x1', dots[row][col].x)
                    .attr('y1', dots[row][col].y)
                    .attr('x2', dots[row + 1][col].x)
                    .attr('y2', dots[row + 1][col].y)
                    .attr('stroke', '#444')
                    .attr('stroke-width', 1);
            }
        }
    });
}

function drawCircularDots(dotsGroup, faceConfigs, size, dotRadius) {
    Object.keys(faceConfigs).forEach(faceName => {
        const dots = faceConfigs[faceName].dots;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const dot = dots[row][col];
                const dotId = `dot-${faceName}-${row}-${col}`;

                const circle = dotsGroup.append('circle')
                    .attr('id', dotId)
                    .attr('cx', dot.x)
                    .attr('cy', dot.y)
                    .attr('r', dotRadius)
                    .attr('fill', dot.color)
                    .attr('stroke', '#111')
                    .attr('stroke-width', 1.5);

                circularState.dotElements[dotId] = {
                    element: circle,
                    x: dot.x,
                    y: dot.y,
                    face: faceName,
                    row: row,
                    col: col,
                    currentColor: dot.color,  // Store current color for animation
                    circleGroup1: dot.circleGroup1,
                    circleGroup2: dot.circleGroup2
                };
            }
        }
    });
}

function updateCircularDots() {
    if (!circularState.dotElements || Object.keys(circularState.dotElements).length === 0) {
        renderCircularDiagram();
        return;
    }

    // Cancel all running animations and snap dots to home positions
    stopAllCircularAnimations();

    // Get previous colors and calculate new colors
    const changedDots = [];
    Object.keys(circularState.dotElements).forEach(dotId => {
        const dotInfo = circularState.dotElements[dotId];
        if (!dotInfo) return;

        const faceState = diagramState.faces[dotInfo.face];
        if (!faceState || !faceState[dotInfo.row]) return;

        const newColor = faceState[dotInfo.row][dotInfo.col];
        if (dotInfo.currentColor !== newColor) {
            changedDots.push({ dotId, dotInfo, newColor });
        }
    });

    if (changedDots.length === 0) return;

    // Animate all changed dots
    const duration = 400;
    changedDots.forEach(({ dotId, dotInfo, newColor }) => {
        const circleCenter = getCircleCenterForDot(dotInfo);
        if (circleCenter) {
            animateDotAlongArc(dotId, dotInfo, circleCenter, newColor, duration);
        } else {
            d3.select('#' + dotId).attr('fill', newColor);
        }
        dotInfo.currentColor = newColor;
    });
}

function stopAllCircularAnimations() {
    // Stop all running timers
    circularState.activeTimers.forEach(timer => timer.stop());
    circularState.activeTimers = [];

    // Snap all dots to their correct home positions
    Object.keys(circularState.dotElements).forEach(dotId => {
        const dotInfo = circularState.dotElements[dotId];
        if (dotInfo) {
            d3.select('#' + dotId)
                .attr('cx', dotInfo.x)
                .attr('cy', dotInfo.y);
        }
    });
}

function getCircleCenterForDot(dotInfo) {
    // Each face is at intersection of two circle groups
    // Return one of the circle centers for arc animation
    if (!circularState.groupCenters || circularState.groupCenters.length < 3) return null;

    const faceToGroups = {
        'right': 0,   // Use group 0 (top)
        'left': 0,
        'front': 0,
        'back': 0,
        'top': 1,     // Use group 1 (bottom-left)
        'bottom': 1
    };

    const groupIdx = faceToGroups[dotInfo.face];
    if (groupIdx === undefined) return null;

    return circularState.groupCenters[groupIdx];
}

function animateDotAlongArc(dotId, dotInfo, center, newColor, duration) {
    const element = d3.select('#' + dotId);
    if (element.empty()) return;

    // Use stored home position, not DOM position
    const homeX = dotInfo.x;
    const homeY = dotInfo.y;

    const radius = Math.sqrt(
        Math.pow(homeX - center.x, 2) + Math.pow(homeY - center.y, 2)
    );
    const startAngle = Math.atan2(homeY - center.y, homeX - center.x);

    // Full circle in rotation direction
    const clockwise = circularState.lastRotationClockwise !== false;
    const arcAngle = clockwise ? -Math.PI * 2 : Math.PI * 2;

    const timer = d3.timer(function(elapsed) {
        const progress = Math.min(elapsed / duration, 1);

        // Linear movement - no easing
        const currentAngle = startAngle + arcAngle * progress;
        element
            .attr('cx', center.x + radius * Math.cos(currentAngle))
            .attr('cy', center.y + radius * Math.sin(currentAngle));

        // Change color at halfway point
        if (progress >= 0.5) {
            element.attr('fill', newColor);
        }

        if (progress >= 1) {
            element.attr('cx', homeX).attr('cy', homeY);
            return true;
        }
        return false;
    });

    // Track timer so we can cancel it
    circularState.activeTimers.push(timer);
}

// ============ UPDATE FROM 3D CUBE ============
function updateDiagramFromCube(clockwise) {
    if (!cubeState.cubies || cubeState.cubies.length === 0) return;

    // Store rotation direction for animation
    circularState.lastRotationClockwise = clockwise;

    const size = cubeState.size;
    diagramState.size = size;
    diagramState.cellSize = size === 2 ? 35 : 25;

    diagramState.faces = {
        top: createFaceState('top', size),
        bottom: createFaceState('bottom', size),
        front: createFaceState('front', size),
        back: createFaceState('back', size),
        left: createFaceState('left', size),
        right: createFaceState('right', size)
    };

    const threshold = 0.1;
    const layerPos = (size - 1) / 2 * (CUBIE_SIZE * 2 + GAP);

    cubeState.cubies.forEach(cubie => {
        const pos = cubie.position;

        const gridX = Math.round((pos.x / (CUBIE_SIZE * 2 + GAP)) + (size - 1) / 2);
        const gridY = Math.round((pos.y / (CUBIE_SIZE * 2 + GAP)) + (size - 1) / 2);
        const gridZ = Math.round((pos.z / (CUBIE_SIZE * 2 + GAP)) + (size - 1) / 2);

        if (pos.x > layerPos - threshold) {
            const color = getFaceColor(cubie, 0);
            if (color) diagramState.faces.right[size - 1 - gridY][size - 1 - gridZ] = color;
        }
        if (pos.x < -layerPos + threshold) {
            const color = getFaceColor(cubie, 1);
            if (color) diagramState.faces.left[size - 1 - gridY][gridZ] = color;
        }
        if (pos.y > layerPos - threshold) {
            const color = getFaceColor(cubie, 2);
            if (color) diagramState.faces.top[size - 1 - gridZ][gridX] = color;
        }
        if (pos.y < -layerPos + threshold) {
            const color = getFaceColor(cubie, 3);
            if (color) diagramState.faces.bottom[gridZ][gridX] = color;
        }
        if (pos.z > layerPos - threshold) {
            const color = getFaceColor(cubie, 4);
            if (color) diagramState.faces.front[size - 1 - gridY][gridX] = color;
        }
        if (pos.z < -layerPos + threshold) {
            const color = getFaceColor(cubie, 5);
            if (color) diagramState.faces.back[size - 1 - gridY][size - 1 - gridX] = color;
        }
    });

    // For circular view, animate the transition; for others, re-render
    if (diagramState.view === 'circular' && Object.keys(circularState.dotElements).length > 0) {
        updateCircularDots();
    } else {
        renderCurrentView();
    }
}

// Get the color of the face pointing in a world direction
// worldDir: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
function getFaceColor(cubie, worldDir) {
    if (!cubie.material) return null;

    // World direction vectors
    const worldDirs = [
        new THREE.Vector3(1, 0, 0),   // 0: +X (right)
        new THREE.Vector3(-1, 0, 0),  // 1: -X (left)
        new THREE.Vector3(0, 1, 0),   // 2: +Y (top)
        new THREE.Vector3(0, -1, 0),  // 3: -Y (bottom)
        new THREE.Vector3(0, 0, 1),   // 4: +Z (front)
        new THREE.Vector3(0, 0, -1)   // 5: -Z (back)
    ];

    // Local face normals (before rotation)
    const localNormals = [
        new THREE.Vector3(1, 0, 0),   // material[0]: +X
        new THREE.Vector3(-1, 0, 0),  // material[1]: -X
        new THREE.Vector3(0, 1, 0),   // material[2]: +Y
        new THREE.Vector3(0, -1, 0),  // material[3]: -Y
        new THREE.Vector3(0, 0, 1),   // material[4]: +Z
        new THREE.Vector3(0, 0, -1)   // material[5]: -Z
    ];

    // Get the world direction we're looking for
    const targetDir = worldDirs[worldDir];

    // Transform target direction to cubie's local space
    const invQuat = cubie.quaternion.clone().invert();
    const localTargetDir = targetDir.clone().applyQuaternion(invQuat);

    // Find which local face normal best matches the local target direction
    let bestMatch = 0;
    let bestDot = -Infinity;

    for (let i = 0; i < 6; i++) {
        const dot = localNormals[i].dot(localTargetDir);
        if (dot > bestDot) {
            bestDot = dot;
            bestMatch = i;
        }
    }

    // Get color from the matching material
    const material = cubie.material[bestMatch];
    if (!material || !material.color) return null;

    const hex = '#' + material.color.getHexString();
    if (hex === '#111111') return null;

    return hex;
}

// ============ PYRAMINX DIAGRAM ============
var pyraminxDiagramState = {
    colors: {
        front: '#e94560',   // red
        right: '#4ecca3',   // green
        left: '#3498db',    // blue
        bottom: '#f1c40f'   // yellow
    },
    faces: {}
};

function initPyraminxDiagram() {
    diagramState.puzzleType = 'pyraminx';

    // Initialize face states with solved colors (9 stickers per face)
    pyraminxDiagramState.faces = {
        front: Array(9).fill(pyraminxDiagramState.colors.front),
        right: Array(9).fill(pyraminxDiagramState.colors.right),
        left: Array(9).fill(pyraminxDiagramState.colors.left),
        bottom: Array(9).fill(pyraminxDiagramState.colors.bottom)
    };

    // Setup view switcher only once
    if (!diagramState.initialized) {
        setupViewSwitcher();
        diagramState.initialized = true;
    }

    renderPyraminxDiagram();
}

function renderPyraminxDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '';

    const svgSize = 300;
    const cx = svgSize / 2;
    const cy = svgSize / 2;

    const svg = d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    // Face layout: front in center, left/right/bottom at 120° intervals
    const faceSize = 50;
    const outerDist = 65;

    // Center face (front) - pointing up
    renderPyraminxFace(svg, 'front', cx, cy, faceSize, 0);

    // Bottom face - pointing down, at bottom
    renderPyraminxFace(svg, 'bottom', cx, cy + outerDist, faceSize, 180);

    // Left face - at top-left
    const leftX = cx - outerDist * Math.sin(Math.PI / 3);
    const leftY = cy - outerDist * Math.cos(Math.PI / 3);
    renderPyraminxFace(svg, 'left', leftX, leftY, faceSize, -60);

    // Right face - at top-right
    const rightX = cx + outerDist * Math.sin(Math.PI / 3);
    const rightY = cy - outerDist * Math.cos(Math.PI / 3);
    renderPyraminxFace(svg, 'right', rightX, rightY, faceSize, 60);

    // Labels
    svg.append('text').attr('x', cx).attr('y', cy + faceSize * 0.15).attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', '9px').text('F');
    svg.append('text').attr('x', cx).attr('y', cy + outerDist + faceSize * 0.15).attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', '9px').text('B');
    svg.append('text').attr('x', leftX - faceSize * 0.4).attr('y', leftY + faceSize * 0.15).attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', '9px').text('L');
    svg.append('text').attr('x', rightX + faceSize * 0.4).attr('y', rightY + faceSize * 0.15).attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', '9px').text('R');
}

function renderPyraminxFace(svg, faceName, cx, cy, size, rotation) {
    const faceColors = pyraminxDiagramState.faces[faceName];
    if (!faceColors) return;

    const group = svg.append('g')
        .attr('class', `pyraminx-face face-${faceName}`)
        .attr('transform', `translate(${cx}, ${cy}) rotate(${rotation})`);

    // Triangle dimensions
    const h = size * Math.sqrt(3) / 2;
    const rows = 3;
    const triHeight = h / rows;
    const triWidth = size / rows;

    // Build triangles row by row
    // Row 0: 1 triangle (index 0)
    // Row 1: 3 triangles (indices 1,2,3)
    // Row 2: 5 triangles (indices 4,5,6,7,8)
    let stickerIndex = 0;

    for (let row = 0; row < rows; row++) {
        const rowY = -h / 2 + triHeight * (row + 0.5);
        const numTris = 2 * row + 1;
        const rowWidth = triWidth * (row + 1);

        for (let col = 0; col < numTris; col++) {
            // Triangle orientation pattern:
            // Row 0: UP (tip)
            // Row 1: UP, DOWN, UP
            // Row 2: UP, DOWN, UP, DOWN, UP
            const isDown = col % 2 === 1;
            const triCenterX = -rowWidth / 2 + triWidth * (col + 1) / 2;

            let points;
            if (isDown) {
                // Pointing down triangle
                points = [
                    [triCenterX - triWidth / 2, rowY - triHeight / 2],
                    [triCenterX + triWidth / 2, rowY - triHeight / 2],
                    [triCenterX, rowY + triHeight / 2]
                ];
            } else {
                // Pointing up triangle
                points = [
                    [triCenterX, rowY - triHeight / 2],
                    [triCenterX + triWidth / 2, rowY + triHeight / 2],
                    [triCenterX - triWidth / 2, rowY + triHeight / 2]
                ];
            }

            const pointsStr = points.map(p => p.join(',')).join(' ');
            group.append('polygon')
                .attr('points', pointsStr)
                .attr('fill', faceColors[stickerIndex] || '#333')
                .attr('stroke', '#222')
                .attr('stroke-width', 1);

            stickerIndex++;
        }
    }
}

function updatePyraminxDiagram() {
    if (!pyraminxState.pieces || pyraminxState.pieces.length === 0) return;

    // Reset faces
    pyraminxDiagramState.faces = {
        front: Array(9).fill(null),
        right: Array(9).fill(null),
        left: Array(9).fill(null),
        bottom: Array(9).fill(null)
    };

    // Read colors from 3D pieces
    pyraminxState.pieces.forEach(piece => {
        const faceName = piece.userData.face;
        const index = piece.userData.index;

        if (faceName && index !== undefined && pyraminxDiagramState.faces[faceName]) {
            const color = '#' + piece.material.color.getHexString();
            pyraminxDiagramState.faces[faceName][index] = color;
        }
    });

    renderPyraminxDiagram();
}
