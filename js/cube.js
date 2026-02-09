const CUBE_COLORS = {
    top: 0xffff00,      // yellow
    bottom: 0x0000ff,   // blue
    front: 0xffffff,    // white
    back: 0x00ff00,     // green
    right: 0xff0000,    // red
    left: 0xffa500      // orange
};

const CUBIE_SIZE = 0.45;
const GAP = 0.02;

var cubeState = {
    group: null,
    cubies: [],
    size: 2,
    sizeX: 2,
    sizeY: 2,
    sizeZ: 2,
    isCuboid: false,
    isAnimating: false,
    animationQueue: []
};

function createCube(size) {
    size = size || 2;
    cubeState.size = size;
    cubeState.sizeX = size;
    cubeState.sizeY = size;
    cubeState.sizeZ = size;
    cubeState.isCuboid = false;
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                const cubie = createCubie(x, y, z, size, size, size);
                const posX = (x - (size - 1) / 2) * (CUBIE_SIZE * 2 + GAP);
                const posY = (y - (size - 1) / 2) * (CUBIE_SIZE * 2 + GAP);
                const posZ = (z - (size - 1) / 2) * (CUBIE_SIZE * 2 + GAP);

                cubie.position.set(posX, posY, posZ);
                cubie.userData = {
                    gridPos: { x, y, z },
                    originalPos: { x: posX, y: posY, z: posZ }
                };

                cubeState.cubies.push(cubie);
                cubeState.group.add(cubie);
            }
        }
    }

    return cubeState.group;
}

// Figure layouts for 1x2x3 cuboid (6 cubies)
// Each entry has position [x, y, z] and scale factor
const CUBOID_FIGURES = {
    block: {
        cubies: [
            { pos: [0, -1, -0.5], scale: 1, grid: [0, 0, 0] },
            { pos: [0, 0, -0.5], scale: 1, grid: [0, 1, 0] },
            { pos: [0, 1, -0.5], scale: 1, grid: [0, 2, 0] },
            { pos: [0, -1, 0.5], scale: 1, grid: [0, 0, 1] },
            { pos: [0, 0, 0.5], scale: 1, grid: [0, 1, 1] },
            { pos: [0, 1, 0.5], scale: 1, grid: [0, 2, 1] }
        ]
    },
    tree: {
        // Christmas tree - triangular prism pieces
        // Arranged with depth so F/B moves work (F=front half, B=back half)
        useWedges: true,
        thinDepth: true,  // Use thinner wedges
        cubies: [
            // All pieces at Z=0, grouped by row
            // Y spacing of 0.68 makes wedges touch (wedge height = 0.315, unit = 0.92)
            // Top row
            { pos: [0, 0.68, 0], row: 'top', side: 'left' },
            { pos: [0, 0.68, 0], row: 'top', side: 'right' },
            // Middle row
            { pos: [0, 0, 0], row: 'middle', side: 'left' },
            { pos: [0, 0, 0], row: 'middle', side: 'right' },
            // Bottom row
            { pos: [0, -0.68, 0], row: 'bottom', side: 'left' },
            { pos: [0, -0.68, 0], row: 'bottom', side: 'right' }
        ]
    }
};

var currentCuboidFigure = 'block';

function createCuboid(sizeX, sizeY, sizeZ, figure) {
    figure = figure || 'block';
    currentCuboidFigure = figure;

    // Set dimensions based on figure layout
    if (figure === 'block' || figure === 'tree') {
        // Both use 1x3x2 layout (X=1, Y=3 rows, Z=2 depth)
        cubeState.sizeX = 1;
        cubeState.sizeY = 3;
        cubeState.sizeZ = 2;
    } else {
        cubeState.sizeX = sizeX;
        cubeState.sizeY = sizeY;
        cubeState.sizeZ = sizeZ;
    }
    cubeState.size = Math.max(cubeState.sizeX, cubeState.sizeY, cubeState.sizeZ);
    cubeState.isCuboid = true;
    cubeState.figure = figure;
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    const figureData = CUBOID_FIGURES[figure] || CUBOID_FIGURES.block;
    const unit = CUBIE_SIZE * 2 + GAP;

    figureData.cubies.forEach((cubieData, index) => {
        // For coloring, use grid from figure data or calculate from index
        let gridX, gridY, gridZ;
        if (cubieData.grid) {
            [gridX, gridY, gridZ] = cubieData.grid;
        } else {
            gridX = 0;
            gridY = index < 3 ? 0 : 1;
            gridZ = index % 3;
        }

        let cubie;
        if (figureData.useWedges) {
            cubie = createTreeWedge(cubieData.row, cubieData.side, gridY, gridZ, figureData.thinDepth);
        } else {
            const scale = cubieData.scale || 1;
            // For vertical block: 1x3x2 (X=1, Y=3, Z=2)
            cubie = createScaledCubie(gridX, gridY, gridZ, 1, 3, 2, scale);
        }

        const posX = cubieData.pos[0] * unit;
        const posY = cubieData.pos[1] * unit;
        const posZ = cubieData.pos[2] * unit;

        cubie.position.set(posX, posY, posZ);
        cubie.userData = {
            gridPos: { x: gridX, y: gridY, z: gridZ },
            originalPos: { x: posX, y: posY, z: posZ },
            figureIndex: index,
            row: cubieData.row,
            side: cubieData.side
        };

        cubeState.cubies.push(cubie);
        cubeState.group.add(cubie);
    });

    return cubeState.group;
}

function createTreeWedge(row, side, gridY, gridZ, thinDepth) {
    const depth = thinDepth ? CUBIE_SIZE * 0.7 : CUBIE_SIZE * 1.5;
    const geometry = new THREE.BufferGeometry();

    let vertices;
    const h = CUBIE_SIZE * 0.7;  // height (smaller)
    const w = CUBIE_SIZE * 0.8;  // width (smaller)
    const d = depth;             // depth

    if (row === 'top') {
        // Small prism (trapezoid) - not pointed
        const topW = w * 0.3;   // narrow top
        const botW = w * 0.6;   // wider bottom

        if (side === 'left') {
            vertices = new Float32Array([
                // Front face (trapezoid as 2 triangles)
                -topW, h, d/2,    -botW, -h, d/2,    0, -h, d/2,
                -topW, h, d/2,    0, -h, d/2,        0, h, d/2,
                // Back face
                -topW, h, -d/2,   0, h, -d/2,        0, -h, -d/2,
                -topW, h, -d/2,   0, -h, -d/2,       -botW, -h, -d/2,
                // Bottom face
                -botW, -h, d/2,   -botW, -h, -d/2,   0, -h, -d/2,
                -botW, -h, d/2,   0, -h, -d/2,       0, -h, d/2,
                // Top face
                -topW, h, d/2,    0, h, d/2,         0, h, -d/2,
                -topW, h, d/2,    0, h, -d/2,        -topW, h, -d/2,
                // Left face (slanted)
                -topW, h, d/2,    -topW, h, -d/2,    -botW, -h, -d/2,
                -topW, h, d/2,    -botW, -h, -d/2,   -botW, -h, d/2,
                // Right face
                0, h, d/2,        0, -h, d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, h, -d/2,
            ]);
        } else {
            vertices = new Float32Array([
                // Front face
                0, h, d/2,        0, -h, d/2,        botW, -h, d/2,
                0, h, d/2,        botW, -h, d/2,     topW, h, d/2,
                // Back face
                0, h, -d/2,       topW, h, -d/2,     botW, -h, -d/2,
                0, h, -d/2,       botW, -h, -d/2,    0, -h, -d/2,
                // Bottom face
                0, -h, d/2,       0, -h, -d/2,       botW, -h, -d/2,
                0, -h, d/2,       botW, -h, -d/2,    botW, -h, d/2,
                // Top face
                0, h, d/2,        topW, h, d/2,      topW, h, -d/2,
                0, h, d/2,        topW, h, -d/2,     0, h, -d/2,
                // Right face (slanted)
                topW, h, d/2,     botW, -h, d/2,     botW, -h, -d/2,
                topW, h, d/2,     botW, -h, -d/2,    topW, h, -d/2,
                // Left face
                0, h, d/2,        0, h, -d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, -h, d/2,
            ]);
        }
    } else if (row === 'bottom') {
        // Bottom row with trunk bumps
        const topW = w * 0.7;
        const botW = w * 1.3;
        const trunkW = w * 0.3;
        const trunkH = h * 0.4;

        if (side === 'left') {
            // Main trapezoid + small trunk bump
            vertices = new Float32Array([
                // Front face (trapezoid)
                -topW, h, d/2,    -botW, -h, d/2,    0, -h, d/2,
                -topW, h, d/2,    0, -h, d/2,        0, h, d/2,
                // Back face
                -topW, h, -d/2,   0, h, -d/2,        0, -h, -d/2,
                -topW, h, -d/2,   0, -h, -d/2,       -botW, -h, -d/2,
                // Bottom face
                -botW, -h, d/2,   -botW, -h, -d/2,   0, -h, -d/2,
                -botW, -h, d/2,   0, -h, -d/2,       0, -h, d/2,
                // Top face
                -topW, h, d/2,    0, h, d/2,         0, h, -d/2,
                -topW, h, d/2,    0, h, -d/2,        -topW, h, -d/2,
                // Left face (slanted)
                -topW, h, d/2,    -topW, h, -d/2,    -botW, -h, -d/2,
                -topW, h, d/2,    -botW, -h, -d/2,   -botW, -h, d/2,
                // Right face
                0, h, d/2,        0, -h, d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, h, -d/2,
                // Trunk bump - front
                -trunkW, -h, d/2,    -trunkW, -h-trunkH, d/2,    0, -h-trunkH, d/2,
                -trunkW, -h, d/2,    0, -h-trunkH, d/2,          0, -h, d/2,
                // Trunk bump - back
                -trunkW, -h, -d/2,   0, -h, -d/2,                0, -h-trunkH, -d/2,
                -trunkW, -h, -d/2,   0, -h-trunkH, -d/2,         -trunkW, -h-trunkH, -d/2,
                // Trunk bump - bottom
                -trunkW, -h-trunkH, d/2,    -trunkW, -h-trunkH, -d/2,    0, -h-trunkH, -d/2,
                -trunkW, -h-trunkH, d/2,    0, -h-trunkH, -d/2,          0, -h-trunkH, d/2,
                // Trunk bump - left
                -trunkW, -h, d/2,       -trunkW, -h, -d/2,      -trunkW, -h-trunkH, -d/2,
                -trunkW, -h, d/2,       -trunkW, -h-trunkH, -d/2,   -trunkW, -h-trunkH, d/2,
            ]);
        } else {
            vertices = new Float32Array([
                // Front face
                0, h, d/2,        0, -h, d/2,        botW, -h, d/2,
                0, h, d/2,        botW, -h, d/2,     topW, h, d/2,
                // Back face
                0, h, -d/2,       topW, h, -d/2,     botW, -h, -d/2,
                0, h, -d/2,       botW, -h, -d/2,    0, -h, -d/2,
                // Bottom face
                0, -h, d/2,       0, -h, -d/2,       botW, -h, -d/2,
                0, -h, d/2,       botW, -h, -d/2,    botW, -h, d/2,
                // Top face
                0, h, d/2,        topW, h, d/2,      topW, h, -d/2,
                0, h, d/2,        topW, h, -d/2,     0, h, -d/2,
                // Right face (slanted)
                topW, h, d/2,     botW, -h, d/2,     botW, -h, -d/2,
                topW, h, d/2,     botW, -h, -d/2,    topW, h, -d/2,
                // Left face
                0, h, d/2,        0, h, -d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, -h, d/2,
                // Trunk bump - front
                0, -h, d/2,       0, -h-trunkH, d/2,     trunkW, -h-trunkH, d/2,
                0, -h, d/2,       trunkW, -h-trunkH, d/2,    trunkW, -h, d/2,
                // Trunk bump - back
                0, -h, -d/2,      trunkW, -h, -d/2,      trunkW, -h-trunkH, -d/2,
                0, -h, -d/2,      trunkW, -h-trunkH, -d/2,   0, -h-trunkH, -d/2,
                // Trunk bump - bottom
                0, -h-trunkH, d/2,    0, -h-trunkH, -d/2,    trunkW, -h-trunkH, -d/2,
                0, -h-trunkH, d/2,    trunkW, -h-trunkH, -d/2,   trunkW, -h-trunkH, d/2,
                // Trunk bump - right
                trunkW, -h, d/2,      trunkW, -h-trunkH, d/2,    trunkW, -h-trunkH, -d/2,
                trunkW, -h, d/2,      trunkW, -h-trunkH, -d/2,   trunkW, -h, -d/2,
            ]);
        }
    } else {
        // Trapezoid wedge for middle and bottom rows
        const topW = (row === 'middle') ? w * 0.5 : w * 0.7;
        const botW = (row === 'middle') ? w * 1.0 : w * 1.3;

        if (side === 'left') {
            vertices = new Float32Array([
                // Front face (trapezoid as 2 triangles)
                -topW, h, d/2,    -botW, -h, d/2,    0, -h, d/2,
                -topW, h, d/2,    0, -h, d/2,        0, h, d/2,
                // Back face
                -topW, h, -d/2,   0, h, -d/2,        0, -h, -d/2,
                -topW, h, -d/2,   0, -h, -d/2,       -botW, -h, -d/2,
                // Bottom face
                -botW, -h, d/2,   -botW, -h, -d/2,   0, -h, -d/2,
                -botW, -h, d/2,   0, -h, -d/2,       0, -h, d/2,
                // Top face
                -topW, h, d/2,    0, h, d/2,         0, h, -d/2,
                -topW, h, d/2,    0, h, -d/2,        -topW, h, -d/2,
                // Left face (slanted)
                -topW, h, d/2,    -topW, h, -d/2,    -botW, -h, -d/2,
                -topW, h, d/2,    -botW, -h, -d/2,   -botW, -h, d/2,
                // Right face
                0, h, d/2,        0, -h, d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, h, -d/2,
            ]);
        } else {
            vertices = new Float32Array([
                // Front face
                0, h, d/2,        0, -h, d/2,        botW, -h, d/2,
                0, h, d/2,        botW, -h, d/2,     topW, h, d/2,
                // Back face
                0, h, -d/2,       topW, h, -d/2,     botW, -h, -d/2,
                0, h, -d/2,       botW, -h, -d/2,    0, -h, -d/2,
                // Bottom face
                0, -h, d/2,       0, -h, -d/2,       botW, -h, -d/2,
                0, -h, d/2,       botW, -h, -d/2,    botW, -h, d/2,
                // Top face
                0, h, d/2,        topW, h, d/2,      topW, h, -d/2,
                0, h, d/2,        topW, h, -d/2,     0, h, -d/2,
                // Right face (slanted)
                topW, h, d/2,     botW, -h, d/2,     botW, -h, -d/2,
                topW, h, d/2,     botW, -h, -d/2,    topW, h, -d/2,
                // Left face
                0, h, d/2,        0, h, -d/2,        0, -h, -d/2,
                0, h, d/2,        0, -h, -d/2,       0, -h, d/2,
            ]);
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    // Use vertex colors for different faces
    const colors = getTreeFaceColors(row, side);
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
    });

    // Apply colors per face
    const colorArray = new Float32Array(vertices.length);
    const faceCount = vertices.length / 9; // 3 vertices per triangle, 3 components per vertex

    for (let i = 0; i < faceCount; i++) {
        const faceColor = colors[i % colors.length];
        const r = ((faceColor >> 16) & 255) / 255;
        const g = ((faceColor >> 8) & 255) / 255;
        const b = (faceColor & 255) / 255;

        // 3 vertices per triangle, 3 color components per vertex
        for (let v = 0; v < 3; v++) {
            colorArray[i * 9 + v * 3] = r;
            colorArray[i * 9 + v * 3 + 1] = g;
            colorArray[i * 9 + v * 3 + 2] = b;
        }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const mesh = new THREE.Mesh(geometry, material);

    // Add edges
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    mesh.add(edges);

    return mesh;
}

function getTreeFaceColors(row, side) {
    // Colors for each face of the wedge pieces (matching CUBE_COLORS)
    const front = CUBE_COLORS.front;   // white
    const back = CUBE_COLORS.back;     // green
    const bottom = CUBE_COLORS.bottom; // blue
    const top = CUBE_COLORS.top;       // yellow
    const brown = 0x8B4513;

    const slantColor = side === 'left' ? CUBE_COLORS.left : CUBE_COLORS.right;
    const innerColor = 0x111111;  // dark for inner faces

    if (row === 'top') {
        // Prism: front(2), back(2), bottom(2), top(2), slant(2), inner(2)
        return [
            front, front,           // front
            back, back,             // back
            bottom, bottom,         // bottom
            top, top,               // top
            slantColor, slantColor, // outer slant
            innerColor, innerColor  // inner face
        ];
    } else if (row === 'bottom') {
        // Trapezoid + trunk: front(2), back(2), bottom(2), top(2), slant(2), inner(2), trunk faces(8)
        return [
            front, front,           // front
            back, back,             // back
            bottom, bottom,         // bottom (hidden by trunk)
            top, top,               // top
            slantColor, slantColor, // outer slant
            innerColor, innerColor, // inner face
            brown, brown,           // trunk front
            brown, brown,           // trunk back
            brown, brown,           // trunk bottom
            brown, brown            // trunk side
        ];
    } else {
        // Middle: front(2), back(2), bottom(2), top(2), slant(2), inner(2)
        return [
            front, front,           // front
            back, back,             // back
            bottom, bottom,         // bottom
            top, top,               // top
            slantColor, slantColor, // outer slant
            innerColor, innerColor  // inner face
        ];
    }
}

function createScaledCubie(x, y, z, sizeX, sizeY, sizeZ, scale) {
    const size = CUBIE_SIZE * 2 * scale;
    const geometry = new THREE.BoxGeometry(size, size, size);

    // Determine which faces are visible (on the outside)
    const materials = [];

    // Right face (+X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === sizeX - 1 ? CUBE_COLORS.right : 0x111111
    }));
    // Left face (-X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === 0 ? CUBE_COLORS.left : 0x111111
    }));
    // Top face (+Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === sizeY - 1 ? CUBE_COLORS.top : 0x111111
    }));
    // Bottom face (-Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === 0 ? CUBE_COLORS.bottom : 0x111111
    }));
    // Front face (+Z)
    materials.push(new THREE.MeshLambertMaterial({
        color: z === sizeZ - 1 ? CUBE_COLORS.front : 0x111111
    }));
    // Back face (-Z)
    materials.push(new THREE.MeshLambertMaterial({
        color: z === 0 ? CUBE_COLORS.back : 0x111111
    }));

    const cubie = new THREE.Mesh(geometry, materials);

    // Add black edges
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubie.add(edges);

    return cubie;
}

function createCubie(x, y, z, sizeX, sizeY, sizeZ) {
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE * 2, CUBIE_SIZE * 2, CUBIE_SIZE * 2);

    // Determine which faces are visible (on the outside)
    const materials = [];

    // Right face (+X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === sizeX - 1 ? CUBE_COLORS.right : 0x111111
    }));
    // Left face (-X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === 0 ? CUBE_COLORS.left : 0x111111
    }));
    // Top face (+Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === sizeY - 1 ? CUBE_COLORS.top : 0x111111
    }));
    // Bottom face (-Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === 0 ? CUBE_COLORS.bottom : 0x111111
    }));
    // Front face (+Z)
    materials.push(new THREE.MeshLambertMaterial({
        color: z === sizeZ - 1 ? CUBE_COLORS.front : 0x111111
    }));
    // Back face (-Z)
    materials.push(new THREE.MeshLambertMaterial({
        color: z === 0 ? CUBE_COLORS.back : 0x111111
    }));

    const cubie = new THREE.Mesh(geometry, materials);

    // Add black edges
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubie.add(edges);

    return cubie;
}

function rotateCubeLayer(face, clockwise, onComplete) {
    if (cubeState.isAnimating) {
        cubeState.animationQueue.push({ face, clockwise, onComplete });
        return;
    }

    // Check if move is valid for cuboid dimensions (skip for tree - has custom moves)
    if (cubeState.isCuboid && cubeState.figure !== 'tree') {
        // Block moves on axes with only 1 layer
        if ((face === 'right' || face === 'left') && cubeState.sizeX === 1) return;
        if ((face === 'top' || face === 'bottom') && cubeState.sizeY === 1) return;
        if ((face === 'front' || face === 'back') && cubeState.sizeZ === 1) return;
    }

    const axis = getRotationAxis(face, cubeState.figure);
    const layerCubies = getCubiesInLayer(face);

    if (layerCubies.length === 0) return;

    cubeState.isAnimating = true;

    // Check if face is square (required for 90° turns)
    let faceIsSquare = true;
    if (cubeState.figure === 'tree') {
        // Tree always uses 180° rotations
        faceIsSquare = false;
    } else if (cubeState.isCuboid) {
        if (face === 'right' || face === 'left') {
            faceIsSquare = cubeState.sizeY === cubeState.sizeZ;
        } else if (face === 'top' || face === 'bottom') {
            faceIsSquare = cubeState.sizeX === cubeState.sizeZ;
        } else if (face === 'front' || face === 'back') {
            faceIsSquare = cubeState.sizeX === cubeState.sizeY;
        }
    }

    // Non-square faces can only do 180° turns
    const angle = faceIsSquare
        ? (clockwise ? -Math.PI / 2 : Math.PI / 2)
        : Math.PI;  // 180° turn

    // Adjust direction for certain faces (only matters for 90° turns)
    const adjustedAngle = (faceIsSquare && ['left', 'bottom', 'back'].includes(face)) ? -angle : angle;

    // Longer duration for 180° turns
    const duration = faceIsSquare ? 300 : 450;

    // Calculate pivot for natural rotation
    let pivot = null;
    if (cubeState.figure === 'tree') {
        // Pivot at center of the row (average position)
        if (layerCubies.length > 0) {
            const center = new THREE.Vector3(0, 0, 0);
            layerCubies.forEach(c => center.add(c.position));
            center.divideScalar(layerCubies.length);
            pivot = center;
        }
    }

    animateCubeRotation(layerCubies, axis, adjustedAngle, duration, clockwise, function() {
        // Update tree piece properties after 180° rotation
        if (cubeState.figure === 'tree') {
            updateTreePieceProperties(layerCubies, face);
        }

        cubeState.isAnimating = false;

        if (onComplete) onComplete();

        if (cubeState.animationQueue.length > 0) {
            const next = cubeState.animationQueue.shift();
            rotateCubeLayer(next.face, next.clockwise, next.onComplete);
        }
    }, pivot);
}

function updateTreePieceProperties(cubies, face) {
    // After 180° rotation, update the row/side properties
    // V move (left slice) and C move (right slice): pieces swap rows (top ↔ bottom)
    // U/M/B moves (rows): pieces swap sides (left ↔ right)

    cubies.forEach(cubie => {
        if (face === 'left' || face === 'right') {
            // V/C move: swap rows (top ↔ bottom, middle stays)
            const currentRow = cubie.userData.row;
            if (currentRow === 'top') {
                cubie.userData.row = 'bottom';
            } else if (currentRow === 'bottom') {
                cubie.userData.row = 'top';
            }
            // middle stays middle
        } else {
            // U/M/B moves: swap sides
            const currentSide = cubie.userData.side;
            if (currentSide === 'left') {
                cubie.userData.side = 'right';
            } else if (currentSide === 'right') {
                cubie.userData.side = 'left';
            }
        }
    });
}

function getRotationAxis(face, figure) {
    // For tree figure
    if (figure === 'tree') {
        // U, M, B (rows) rotate around Y axis
        // V (left slice) and C (right slice) rotate around X axis (horizontal left-to-right)
        if (face === 'left' || face === 'right') {
            return new THREE.Vector3(1, 0, 0);
        }
        return new THREE.Vector3(0, 1, 0);
    }

    switch (face) {
        case 'right':
        case 'left':
            return new THREE.Vector3(1, 0, 0);
        case 'top':
        case 'bottom':
        case 'middle':
            return new THREE.Vector3(0, 1, 0);
        case 'front':
        case 'back':
            return new THREE.Vector3(0, 0, 1);
        default:
            return new THREE.Vector3(0, 1, 0);
    }
}

function getCubiesInLayer(face) {
    const threshold = 0.25;
    const layerPosX = (cubeState.sizeX - 1) / 2 * (CUBIE_SIZE * 2 + GAP);
    const layerPosY = (cubeState.sizeY - 1) / 2 * (CUBIE_SIZE * 2 + GAP);
    const layerPosZ = (cubeState.sizeZ - 1) / 2 * (CUBIE_SIZE * 2 + GAP);

    return cubeState.cubies.filter(cubie => {
        const pos = cubie.position;

        // For tree figure: U=top row, M=middle row, B=bottom row, V=left slice, C=right slice
        if (cubeState.figure === 'tree') {
            const row = cubie.userData.row;
            const side = cubie.userData.side;
            if (face === 'top') return row === 'top';
            if (face === 'middle') return row === 'middle';
            if (face === 'bottom') return row === 'bottom';
            if (face === 'left') return side === 'left';   // V key
            if (face === 'right') return side === 'right'; // C key
            return false;
        }

        switch (face) {
            case 'right':
                return pos.x > layerPosX - threshold;
            case 'left':
                return pos.x < -layerPosX + threshold;
            case 'top':
                return pos.y > layerPosY - threshold;
            case 'bottom':
                return pos.y < -layerPosY + threshold;
            case 'front':
                return pos.z > layerPosZ - threshold;
            case 'back':
                return pos.z < -layerPosZ + threshold;
            default:
                return false;
        }
    });
}

function animateCubeRotation(cubies, axis, targetAngle, duration, clockwise, onComplete, customPivot) {
    const startTime = performance.now();
    const pivot = customPivot || new THREE.Vector3(0, 0, 0);

    const startQuaternions = cubies.map(c => c.quaternion.clone());
    const startPositions = cubies.map(c => c.position.clone());

    function update() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentAngle = targetAngle * eased;

        cubies.forEach((cubie, i) => {
            // Reset to start position/rotation
            cubie.position.copy(startPositions[i]);
            cubie.quaternion.copy(startQuaternions[i]);

            // Apply rotation around pivot
            const rotationQuat = new THREE.Quaternion();
            rotationQuat.setFromAxisAngle(axis, currentAngle);

            // Rotate position
            cubie.position.sub(pivot);
            cubie.position.applyQuaternion(rotationQuat);
            cubie.position.add(pivot);

            // Rotate orientation
            cubie.quaternion.premultiply(rotationQuat);
        });

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            // Snap positions to grid
            cubies.forEach(cubie => {
                cubie.position.x = Math.round(cubie.position.x * 100) / 100;
                cubie.position.y = Math.round(cubie.position.y * 100) / 100;
                cubie.position.z = Math.round(cubie.position.z * 100) / 100;
            });

            // Update 2D diagram with rotation direction
            if (typeof updateDiagramFromCube === 'function') {
                updateDiagramFromCube(clockwise);
            }

            if (onComplete) onComplete();
        }
    }

    update();
}

function setupCubeControls() {
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        if (typeof currentPuzzle === 'undefined' || (!currentPuzzle.startsWith('cube') && !currentPuzzle.startsWith('cuboid'))) return;

        const key = e.key.toLowerCase();
        const shift = e.shiftKey;
        const clockwise = !shift;

        switch (key) {
            case 'u':
                e.preventDefault();
                rotateCubeLayer('top', clockwise);
                break;
            case 'd':
                e.preventDefault();
                rotateCubeLayer('bottom', clockwise);
                break;
            case 'r':
                e.preventDefault();
                rotateCubeLayer('right', clockwise);
                break;
            case 'l':
                e.preventDefault();
                rotateCubeLayer('left', clockwise);
                break;
            case 'f':
                e.preventDefault();
                rotateCubeLayer('front', clockwise);
                break;
            case 'b':
                e.preventDefault();
                // For tree, B = bottom row; for others, B = back face
                if (cubeState.figure === 'tree') {
                    rotateCubeLayer('bottom', clockwise);
                } else {
                    rotateCubeLayer('back', clockwise);
                }
                break;
            case 'm':
                e.preventDefault();
                rotateCubeLayer('middle', clockwise);
                break;
            case 'v':
                e.preventDefault();
                rotateCubeLayer('left', clockwise);
                break;
            case 'c':
                e.preventDefault();
                rotateCubeLayer('right', clockwise);
                break;
        }
    });
}

function scrambleCube(moveCount, onComplete) {
    const faces = ['top', 'bottom', 'right', 'left', 'front', 'back'];
    const moves = [];
    let lastFace = null;

    // Scale move count based on cube size
    const size = cubeState.sizeX || 3;
    moveCount = moveCount || (size * size * 3);

    for (let i = 0; i < moveCount; i++) {
        // Avoid same face twice in a row
        let face;
        do {
            face = faces[Math.floor(Math.random() * faces.length)];
        } while (face === lastFace);
        lastFace = face;

        const clockwise = Math.random() < 0.5;
        moves.push({ face, clockwise });
    }

    // Execute moves sequentially
    let index = 0;
    function executeNext() {
        if (index >= moves.length) {
            if (onComplete) onComplete();
            return;
        }
        const move = moves[index++];
        rotateCubeLayer(move.face, move.clockwise, executeNext);
    }

    executeNext();
}
