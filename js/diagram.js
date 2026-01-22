// Cube diagram using D3.js - supports net and circular views
var diagramState = {
    svg: null,
    size: 3,
    cellSize: 25,
    gap: 2,
    view: 'net',
    initialized: false,
    colors: {
        top: '#ffffff',
        bottom: '#ffff00',
        front: '#ff0000',
        back: '#ffa500',
        right: '#0000ff',
        left: '#00ff00'
    },
    faces: {}
};

function initDiagram(size) {
    size = size || 3;
    diagramState.size = size;
    diagramState.cellSize = size === 2 ? 35 : 25;

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
    if (diagramState.view === 'net') {
        renderNetDiagram();
    } else if (diagramState.view === 'circular') {
        renderCircularDiagram();
    } else if (diagramState.view === 'flower') {
        renderFlowerDiagram();
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

// ============ CIRCULAR DIAGRAM ============
function renderCircularDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '';

    const size = diagramState.size;
    const svgSize = 280;
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;
    const innerRadius = svgSize * 0.15;
    const outerRadius = svgSize * 0.42;

    const svg = d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    diagramState.svg = svg;

    // Center face (front)
    renderCenterFace(svg, centerX, centerY, innerRadius * 0.85);

    // Surrounding faces
    const surroundingFaces = [
        { name: 'top', angle: -90 },
        { name: 'right', angle: 0 },
        { name: 'bottom', angle: 90 },
        { name: 'left', angle: 180 }
    ];

    surroundingFaces.forEach(face => {
        renderRadialFace(svg, face.name, centerX, centerY, innerRadius, outerRadius, face.angle);
    });

    // Back face indicator
    renderBackFaceIndicator(svg, centerX, centerY, outerRadius);
}

function renderCenterFace(svg, cx, cy, radius) {
    const size = diagramState.size;
    const faceState = diagramState.faces.front;
    const cellSize = (radius * 2) / size;
    const startX = cx - radius;
    const startY = cy - radius;

    const group = svg.append('g').attr('class', 'face-center');

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            group.append('rect')
                .attr('x', startX + col * cellSize)
                .attr('y', startY + row * cellSize)
                .attr('width', cellSize - 1)
                .attr('height', cellSize - 1)
                .attr('fill', faceState[row][col])
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('rx', 2);
        }
    }

    group.append('text')
        .attr('x', cx)
        .attr('y', cy + radius + 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '9px')
        .text('F');
}

function renderRadialFace(svg, faceName, cx, cy, innerR, outerR, angleDeg) {
    const size = diagramState.size;
    const faceState = diagramState.faces[faceName];
    const angleRad = (angleDeg * Math.PI) / 180;
    const arcSpan = 70;
    const startAngle = angleDeg - arcSpan / 2;
    const cellArcSpan = arcSpan / size;
    const ringWidth = (outerR - innerR) / size;

    const group = svg.append('g').attr('class', `face-radial face-${faceName}`);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const r1 = innerR + row * ringWidth + 1;
            const r2 = innerR + (row + 1) * ringWidth - 1;
            const a1 = ((startAngle + col * cellArcSpan + 0.5) * Math.PI) / 180;
            const a2 = ((startAngle + (col + 1) * cellArcSpan - 0.5) * Math.PI) / 180;

            const arc = d3.arc()
                .innerRadius(r1)
                .outerRadius(r2)
                .startAngle(a1 + Math.PI / 2)
                .endAngle(a2 + Math.PI / 2);

            group.append('path')
                .attr('d', arc)
                .attr('transform', `translate(${cx}, ${cy})`)
                .attr('fill', faceState[row][col])
                .attr('stroke', '#333')
                .attr('stroke-width', 1);
        }
    }

    const labelR = outerR + 10;
    const labelX = cx + labelR * Math.cos(angleRad);
    const labelY = cy + labelR * Math.sin(angleRad);
    group.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '9px')
        .text(faceName.charAt(0).toUpperCase());
}

function renderBackFaceIndicator(svg, cx, cy, outerR) {
    const size = diagramState.size;
    const faceState = diagramState.faces.back;
    const indicatorSize = outerR * 0.25;
    const indicatorX = cx + outerR + 15;
    const indicatorY = cy - indicatorSize / 2;
    const cellSize = indicatorSize / size;

    const group = svg.append('g').attr('class', 'face-back-indicator');

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            group.append('rect')
                .attr('x', indicatorX + col * cellSize)
                .attr('y', indicatorY + row * cellSize)
                .attr('width', cellSize - 1)
                .attr('height', cellSize - 1)
                .attr('fill', faceState[row][col])
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5)
                .attr('rx', 1);
        }
    }

    group.append('text')
        .attr('x', indicatorX + indicatorSize / 2)
        .attr('y', indicatorY + indicatorSize + 8)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '8px')
        .text('B');
}

// ============ FLOWER DIAGRAM (Circle Net) ============
// 3 groups of concentric circles at 120° angles
// Dots positioned at actual circle-circle intersections

var flowerState = {
    dotElements: {},
    groupCenters: [],
    radii: [],
    svgSize: 450,
    cx: 225,
    cy: 225,
    animating: false,
    previousFaces: null  // Store previous state for animation
};

function renderFlowerDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '';
    flowerState.dotElements = {};

    const size = diagramState.size;
    const svgSize = 450;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const dotRadius = size === 2 ? 8 : 6;

    // Store for animation calculations
    flowerState.svgSize = svgSize;
    flowerState.cx = cx;
    flowerState.cy = cy;
    flowerState.dotRadius = dotRadius;

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
    flowerState.groupCenters = groupCenters;

    // Circle radii - larger to ensure proper intersections
    const baseRadius = svgSize * 0.18;
    const radiusStep = svgSize * 0.055;
    const radii = [];
    for (let i = 0; i < size; i++) {
        radii.push(baseRadius + i * radiusStep);
    }
    flowerState.radii = radii;

    // Draw the 3 groups of concentric circles
    const circlesGroup = svg.append('g').attr('class', 'flower-circles');

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
    const linesGroup = svg.append('g').attr('class', 'flower-lines');
    drawFlowerConnections(linesGroup, faceConfigs, size);

    // Draw dots at intersection points
    const dotsGroup = svg.append('g').attr('class', 'flower-dots');
    drawFlowerDots(dotsGroup, faceConfigs, size, dotRadius);
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

function drawFlowerConnections(linesGroup, faceConfigs, size) {
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

function drawFlowerDots(dotsGroup, faceConfigs, size, dotRadius) {
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

                flowerState.dotElements[dotId] = {
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

function updateFlowerDots() {
    if (!flowerState.dotElements || Object.keys(flowerState.dotElements).length === 0) {
        renderFlowerDiagram();
        return;
    }

    // Get previous colors for comparison
    const previousColors = {};
    Object.keys(flowerState.dotElements).forEach(dotId => {
        const dotInfo = flowerState.dotElements[dotId];
        if (dotInfo) {
            previousColors[dotId] = dotInfo.currentColor;
        }
    });

    // Calculate new colors
    const newColors = {};
    Object.keys(flowerState.dotElements).forEach(dotId => {
        const dotInfo = flowerState.dotElements[dotId];
        if (!dotInfo) return;
        const faceState = diagramState.faces[dotInfo.face];
        if (!faceState || !faceState[dotInfo.row]) return;
        newColors[dotId] = faceState[dotInfo.row][dotInfo.col];
    });

    // Find dots that changed and animate them
    animateFlowerTransition(previousColors, newColors);
}

function animateFlowerTransition(previousColors, newColors) {
    const changedDots = [];

    Object.keys(newColors).forEach(dotId => {
        if (previousColors[dotId] !== newColors[dotId]) {
            changedDots.push({
                id: dotId,
                oldColor: previousColors[dotId],
                newColor: newColors[dotId],
                info: flowerState.dotElements[dotId]
            });
        }
    });

    if (changedDots.length === 0) return;

    const duration = 400;

    changedDots.forEach((dot) => {
        const dotInfo = dot.info;

        if (!dotInfo) return;

        // Get circle center for arc animation
        const circleCenter = getCircleCenterForDot(dotInfo);

        if (circleCenter) {
            animateDotAlongArc(dot.id, dotInfo, circleCenter, dot.newColor, duration);
        } else {
            d3.select('#' + dot.id).attr('fill', dot.newColor);
        }

        // Update stored color
        dotInfo.currentColor = dot.newColor;
    });
}

function getCircleCenterForDot(dotInfo) {
    // Each face is at intersection of two circle groups
    // Return one of the circle centers for arc animation
    if (!flowerState.groupCenters || flowerState.groupCenters.length < 3) return null;

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

    return flowerState.groupCenters[groupIdx];
}

function animateDotAlongArc(dotId, dotInfo, center, newColor, duration) {
    const element = d3.select('#' + dotId);
    if (element.empty()) return;

    const startX = parseFloat(element.attr('cx'));
    const startY = parseFloat(element.attr('cy'));

    const radius = Math.sqrt(
        Math.pow(startX - center.x, 2) + Math.pow(startY - center.y, 2)
    );
    const startAngle = Math.atan2(startY - center.y, startX - center.x);

    // Full circle in rotation direction
    const clockwise = flowerState.lastRotationClockwise !== false;
    const arcAngle = clockwise ? -Math.PI * 2 : Math.PI * 2;

    d3.timer(function(elapsed) {
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
            element.attr('cx', startX).attr('cy', startY);
            return true;
        }
        return false;
    });
}

// ============ UPDATE FROM 3D CUBE ============
function updateDiagramFromCube(clockwise) {
    if (!cubeState.cubies || cubeState.cubies.length === 0) return;

    // Store rotation direction for animation
    flowerState.lastRotationClockwise = clockwise;

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

    // For flower view, animate the transition; for others, re-render
    if (diagramState.view === 'flower' && Object.keys(flowerState.dotElements).length > 0) {
        updateFlowerDots();
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

function initPyraminxDiagram() {
    const container = document.getElementById('cube-diagram');
    if (!container) return;

    container.innerHTML = '<p style="color: #666; text-align: center; padding-top: 30px; font-size: 0.85rem;">Pyraminx diagram<br>coming soon</p>';
}
