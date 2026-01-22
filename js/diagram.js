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

// ============ UPDATE FROM 3D CUBE ============
function updateDiagramFromCube() {
    if (!cubeState.cubies || cubeState.cubies.length === 0) return;

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

    renderCurrentView();
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
