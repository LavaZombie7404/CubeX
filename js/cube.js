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

var moveHistory = [];
var isSolving = false;

function createCube(size, figure, color) {
    size = size || 2;
    figure = figure || 'block';
    color = color || 'red';
    cubeState.size = size;
    cubeState.sizeX = size;
    cubeState.sizeY = size;
    cubeState.sizeZ = size;
    cubeState.isCuboid = false;
    cubeState.figure = null;
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    if (size === 1 && figure === 'mirror') {
        cubeState.figure = 'mirror';
        var mirrorColor = MIRROR_COLORS[color] || MIRROR_COLORS.red;
        var geometry = new THREE.BoxGeometry(
            CUBIE_SIZE * 2 * 0.70,
            CUBIE_SIZE * 2 * 1.00,
            CUBIE_SIZE * 2 * 1.30
        );
        var material = new THREE.MeshLambertMaterial({ color: mirrorColor });
        var cubie = new THREE.Mesh(geometry, material);
        var edgesGeometry = new THREE.EdgesGeometry(geometry);
        var edges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        cubie.add(edges);
        cubie.position.set(0, 0, 0);
        cubie.userData = {
            gridPos: { x: 0, y: 0, z: 0 },
            originalPos: { x: 0, y: 0, z: 0 }
        };
        cubeState.cubies.push(cubie);
        cubeState.group.add(cubie);
        return cubeState.group;
    }

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

const MIRROR_COLORS = {
    red: 0xe94560,
    green: 0x4ecca3,
    blue: 0x3498db,
    yellow: 0xf1c40f
};

function createFloppyCube(figure, color) {
    figure = figure || 'block';
    color = color || 'red';

    // 1x3x3 floppy cube - flat 3x3 grid
    const sizeX = 1, sizeY = 3, sizeZ = 3;
    cubeState.size = 3;
    cubeState.sizeX = sizeX;
    cubeState.sizeY = sizeY;
    cubeState.sizeZ = sizeZ;
    cubeState.isCuboid = true;
    cubeState.figure = figure === 'mirror' ? 'mirror' : 'floppy';
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    // For mirror: compute positions so pieces touch (no gaps)
    // Row heights and column widths from mirror piece sizes
    const mirrorScale = 0.9;
    const rowH = [0.60, 1.10, 1.30];  // h values per row
    const colW = [0.60, 1.10, 1.30];  // w values per col

    // Precompute centered Y positions for mirror
    const mirrorPosY = [];
    const mirrorPosZ = [];
    if (figure === 'mirror') {
        let cumY = 0;
        for (let r = 0; r < 3; r++) {
            const halfH = CUBIE_SIZE * rowH[r] * mirrorScale;
            mirrorPosY[r] = cumY + halfH;
            cumY += halfH * 2;
        }
        // Center on the middle piece (row 1) so rotation pivot is at center piece
        const centerY = mirrorPosY[1];
        for (let r = 0; r < 3; r++) mirrorPosY[r] -= centerY;

        let cumZ = 0;
        for (let c = 0; c < 3; c++) {
            const halfW = CUBIE_SIZE * colW[c] * mirrorScale;
            mirrorPosZ[c] = cumZ + halfW;
            cumZ += halfW * 2;
        }
        // Center on the middle piece (col 1) so rotation pivot is at center piece
        const centerZ = mirrorPosZ[1];
        for (let c = 0; c < 3; c++) mirrorPosZ[c] -= centerZ;

        cubeState.mirrorPosY = mirrorPosY.slice();
        cubeState.mirrorPosZ = mirrorPosZ.slice();
    }

    for (let x = 0; x < sizeX; x++) {
        for (let y = 0; y < sizeY; y++) {
            for (let z = 0; z < sizeZ; z++) {
                let cubie;

                if (figure === 'mirror') {
                    cubie = createMirrorPiece(y, z, color);
                } else {
                    cubie = createCubie(x, y, z, sizeX, sizeY, sizeZ);
                }

                let posX, posY, posZ;
                if (figure === 'mirror') {
                    posX = 0;
                    posY = mirrorPosY[y];
                    posZ = mirrorPosZ[z];
                } else {
                    posX = (x - (sizeX - 1) / 2) * (CUBIE_SIZE * 2 + GAP);
                    posY = (y - (sizeY - 1) / 2) * (CUBIE_SIZE * 2 + GAP);
                    posZ = (z - (sizeZ - 1) / 2) * (CUBIE_SIZE * 2 + GAP);
                }

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

function createMirrorPiece(y, z, color) {
    const mirrorColor = MIRROR_COLORS[color] || MIRROR_COLORS.red;

    // Each piece has unique size - all form a rectangle when solved
    // Row heights and col widths: small, medium, large
    // Center (row 1, col 1) sits closer to the smallest corner (0,0)
    const rH = [0.60, 1.10, 1.30]; // row heights
    const cW = [0.60, 1.10, 1.30]; // col widths
    const sizes = {
        '0,0': { h: rH[0], w: cW[0] },
        '0,1': { h: rH[0], w: cW[1] },
        '0,2': { h: rH[0], w: cW[2] },
        '1,0': { h: rH[1], w: cW[0] },
        '1,1': { h: rH[1], w: cW[1] },
        '1,2': { h: rH[1], w: cW[2] },
        '2,0': { h: rH[2], w: cW[0] },
        '2,1': { h: rH[2], w: cW[1] },
        '2,2': { h: rH[2], w: cW[2] }
    };

    const key = `${y},${z}`;
    const size = sizes[key] || { h: 1.0, w: 1.0 };

    const scale = 0.9;
    const geometry = new THREE.BoxGeometry(
        CUBIE_SIZE * 2 * scale,
        CUBIE_SIZE * 2 * size.h * scale,
        CUBIE_SIZE * 2 * size.w * scale
    );

    const material = new THREE.MeshLambertMaterial({ color: mirrorColor });
    const cubie = new THREE.Mesh(geometry, material);

    // Add black edges
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubie.add(edges);

    return cubie;
}

function createCuboidMirrorPiece(y, z, color) {
    var mirrorColor = MIRROR_COLORS[color] || MIRROR_COLORS.red;

    var rH = [0.60, 1.10, 1.30]; // row heights (3 rows)
    var cD = [0.70, 1.30];       // column depths (2 cols)

    var h = rH[y] || 1.0;
    var d = cD[z] || 1.0;

    var scale = 0.9;
    var geometry = new THREE.BoxGeometry(
        CUBIE_SIZE * 2 * scale,
        CUBIE_SIZE * 2 * h * scale,
        CUBIE_SIZE * 2 * d * scale
    );

    var material = new THREE.MeshLambertMaterial({ color: mirrorColor });
    var cubie = new THREE.Mesh(geometry, material);

    var edgesGeometry = new THREE.EdgesGeometry(geometry);
    var edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    var edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubie.add(edges);

    return cubie;
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

function createCuboid(sizeX, sizeY, sizeZ, figure, color) {
    figure = figure || 'block';
    color = color || 'red';
    currentCuboidFigure = figure;

    // All figures use 1x3x2 layout (X=1, Y=3 rows, Z=2 depth)
    cubeState.sizeX = 1;
    cubeState.sizeY = 3;
    cubeState.sizeZ = 2;
    cubeState.size = 3;
    cubeState.isCuboid = true;
    cubeState.figure = figure;
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    if (figure === 'mirror') {
        var mirrorScale = 0.9;
        var rH = [0.60, 1.10, 1.30];
        var cD = [0.70, 1.30];

        var mirrorPosY = [];
        var cumY = 0;
        for (var r = 0; r < 3; r++) {
            var halfH = CUBIE_SIZE * rH[r] * mirrorScale;
            mirrorPosY[r] = cumY + halfH;
            cumY += halfH * 2;
        }
        var centerY = mirrorPosY[1];
        for (var r = 0; r < 3; r++) mirrorPosY[r] -= centerY;

        var mirrorPosZ = [];
        var cumZ = 0;
        for (var c = 0; c < 2; c++) {
            var halfD = CUBIE_SIZE * cD[c] * mirrorScale;
            mirrorPosZ[c] = cumZ + halfD;
            cumZ += halfD * 2;
        }
        var centerZ = (mirrorPosZ[0] + mirrorPosZ[1]) / 2;
        for (var c = 0; c < 2; c++) mirrorPosZ[c] -= centerZ;

        cubeState.mirrorPosY = mirrorPosY.slice();
        cubeState.mirrorPosZ = mirrorPosZ.slice();

        for (var y = 0; y < 3; y++) {
            for (var z = 0; z < 2; z++) {
                var cubie = createCuboidMirrorPiece(y, z, color);
                var posX = 0;
                var posY = mirrorPosY[y];
                var posZ = mirrorPosZ[z];

                cubie.position.set(posX, posY, posZ);
                cubie.userData = {
                    gridPos: { x: 0, y: y, z: z },
                    originalPos: { x: posX, y: posY, z: posZ },
                    figureIndex: y * 2 + z
                };

                cubeState.cubies.push(cubie);
                cubeState.group.add(cubie);
            }
        }

        return cubeState.group;
    }

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
        if ((face === 'right' || face === 'left') && cubeState.sizeX === 1) { if (onComplete) onComplete(); return; }
        if ((face === 'top' || face === 'bottom') && cubeState.sizeY === 1) { if (onComplete) onComplete(); return; }
        if ((face === 'front' || face === 'back') && cubeState.sizeZ === 1) { if (onComplete) onComplete(); return; }
    }

    const axis = getRotationAxis(face, cubeState.figure);
    const layerCubies = getCubiesInLayer(face);

    if (layerCubies.length === 0) { if (onComplete) onComplete(); return; }

    cubeState.isAnimating = true;

    if (!isSolving) {
        moveHistory.push({ type: 'cube', face: face, clockwise: clockwise });
    }

    // Check if face is square (required for 90° turns)
    let faceIsSquare = true;
    if (cubeState.figure === 'tree') {
        // Tree always uses 180° rotations
        faceIsSquare = false;
    } else if (cubeState.figure === 'floppy' || cubeState.figure === 'mirror') {
        // Floppy and mirror use 180° rotations
        faceIsSquare = false;
    } else if (cubeState.isCuboid) {
        if (face === 'right' || face === 'left') {
            faceIsSquare = cubeState.sizeY === cubeState.sizeZ;
        } else if (face === 'top' || face === 'bottom' || face === 'middle') {
            faceIsSquare = cubeState.sizeX === cubeState.sizeZ;
        } else if (face === 'front' || face === 'back' || face === 'standing') {
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

    // Determine axis from face name (supports innerNRight, inner2Top, etc.)
    var fl = face.toLowerCase();
    if (fl.includes('right') || fl.includes('left') || fl === 'middlex') return new THREE.Vector3(1, 0, 0);
    if (fl.includes('top') || fl.includes('bottom') || fl === 'middle') return new THREE.Vector3(0, 1, 0);
    if (fl.includes('front') || fl.includes('back') || fl === 'standing') return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
}

function getCubiesInLayer(face) {
    const threshold = 0.35;
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

        // Inner slice positions for 4x4 (one step in from outer layer)
        const innerStep = CUBIE_SIZE * 2 + GAP;
        const innerPosX = layerPosX - innerStep;
        const innerPosY = layerPosY - innerStep;
        const innerPosZ = layerPosZ - innerStep;

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
            // Middle layer (equator) for floppy cube and odd-sized cubes
            case 'middle':
                return Math.abs(pos.y) < threshold;
            // Standing slice (middle Z) for floppy cube
            case 'standing':
                return Math.abs(pos.z) < threshold;
            // Middle X slice (for odd cubes)
            case 'middleX':
                return Math.abs(pos.x) < threshold;
            // Inner slices depth 1
            case 'innerRight':
                return Math.abs(pos.x - innerPosX) < threshold;
            case 'innerLeft':
                return Math.abs(pos.x + innerPosX) < threshold;
            case 'innerTop':
                return Math.abs(pos.y - innerPosY) < threshold;
            case 'innerBottom':
                return Math.abs(pos.y + innerPosY) < threshold;
            case 'innerFront':
                return Math.abs(pos.z - innerPosZ) < threshold;
            case 'innerBack':
                return Math.abs(pos.z + innerPosZ) < threshold;
            default:
                // Generic inner slice handler: inner2Top, inner3Right, etc.
                var innerMatch = face.match(/^inner(\d+)(Right|Left|Top|Bottom|Front|Back)$/);
                if (innerMatch) {
                    var depth = parseInt(innerMatch[1]);
                    var dir = innerMatch[2];
                    var depthOffset = depth * innerStep;
                    if (dir === 'Right') return Math.abs(pos.x - (layerPosX - depthOffset)) < threshold;
                    if (dir === 'Left') return Math.abs(pos.x + (layerPosX - depthOffset)) < threshold;
                    if (dir === 'Top') return Math.abs(pos.y - (layerPosY - depthOffset)) < threshold;
                    if (dir === 'Bottom') return Math.abs(pos.y + (layerPosY - depthOffset)) < threshold;
                    if (dir === 'Front') return Math.abs(pos.z - (layerPosZ - depthOffset)) < threshold;
                    if (dir === 'Back') return Math.abs(pos.z + (layerPosZ - depthOffset)) < threshold;
                }
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
    var innerDepth = 0;

    document.addEventListener('keyup', function(e) {
        if (e.key === 'Control') innerDepth = 0;
    });

    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        if (typeof currentPuzzle === 'undefined' || (!currentPuzzle.startsWith('cube') && !currentPuzzle.startsWith('cuboid') && currentPuzzle !== 'floppy')) return;

        const key = e.key.toLowerCase();
        const shift = e.shiftKey;
        const ctrl = e.ctrlKey;
        const clockwise = !shift;

        var cubeSize = cubeState.sizeX || 3;

        // Ctrl + digit = buffer inner slice depth
        if (ctrl && key >= '2' && key <= '9' && currentPuzzle.startsWith('cube')) {
            innerDepth = parseInt(key);
            e.preventDefault();
            return;
        }

        // Ctrl + face key = inner slice at buffered depth (default 1)
        if (ctrl && cubeSize >= 4 && currentPuzzle.startsWith('cube')) {
            var depth = innerDepth || 1;
            var maxDepth = Math.floor((cubeSize - 1) / 2);
            innerDepth = 0;
            if (depth > maxDepth) return;
            var prefix = depth === 1 ? 'inner' : 'inner' + depth;
            switch (key) {
                case 'u': e.preventDefault(); rotateCubeLayer(prefix + 'Top', clockwise); return;
                case 'd': e.preventDefault(); rotateCubeLayer(prefix + 'Bottom', clockwise); return;
                case 'r': e.preventDefault(); rotateCubeLayer(prefix + 'Right', clockwise); return;
                case 'l': e.preventDefault(); rotateCubeLayer(prefix + 'Left', clockwise); return;
                case 'f': e.preventDefault(); rotateCubeLayer(prefix + 'Front', clockwise); return;
                case 'b': e.preventDefault(); rotateCubeLayer(prefix + 'Back', clockwise); return;
            }
        }

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
            case 's':
                e.preventDefault();
                rotateCubeLayer('standing', clockwise);
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
    const outerFaces = ['top', 'bottom', 'right', 'left', 'front', 'back'];
    const dirs = ['Top', 'Bottom', 'Right', 'Left', 'Front', 'Back'];
    const middleFaces = ['middle', 'standing', 'middleX'];

    const size = cubeState.sizeX || 3;
    var faces = outerFaces.slice();
    var maxDepth = Math.floor((size - 1) / 2);
    for (var d = 1; d <= maxDepth; d++) {
        var prefix = d === 1 ? 'inner' : 'inner' + d;
        for (var i = 0; i < dirs.length; i++) {
            faces.push(prefix + dirs[i]);
        }
    }
    if (size >= 5 && size % 2 === 1) faces = faces.concat(middleFaces);

    const moves = [];
    let lastFace = null;

    // Scale move count based on cube size
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

function scrambleFloppyCube(moveCount, onComplete) {
    const faces = ['top', 'middle', 'bottom', 'front', 'standing', 'back'];
    const moves = [];
    let lastFace = null;

    moveCount = moveCount || 10;

    for (let i = 0; i < moveCount; i++) {
        let face;
        do {
            face = faces[Math.floor(Math.random() * faces.length)];
        } while (face === lastFace);
        lastFace = face;

        moves.push({ face, clockwise: true }); // 180° moves
    }

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

// ==================== Floppy Cube Solver ====================

// Orientation group: {I=0, Rx=1, Ry=2, Rz=3}
// Composition table for applying rotations (Klein four-group)
const FLOPPY_APPLY_RY = [2, 3, 0, 1]; // ori -> ori after Ry (180° around Y)
const FLOPPY_APPLY_RZ = [3, 2, 1, 0]; // ori -> ori after Rz (180° around Z)

// Move definitions: which grid positions are affected
// Grid index = y*3 + z, y=row(0=bottom,1=mid,2=top), z=col(0=back,1=standing,2=front)
const FLOPPY_MOVES = [
    { name: 'top',      indices: [6, 7, 8], applyOri: FLOPPY_APPLY_RY }, // U: top row, Y-axis
    { name: 'middle',   indices: [3, 4, 5], applyOri: FLOPPY_APPLY_RY }, // M: middle row, Y-axis
    { name: 'bottom',   indices: [0, 1, 2], applyOri: FLOPPY_APPLY_RY }, // D: bottom row, Y-axis
    { name: 'front',    indices: [2, 5, 8], applyOri: FLOPPY_APPLY_RZ }, // F: front col, Z-axis
    { name: 'standing', indices: [1, 4, 7], applyOri: FLOPPY_APPLY_RZ }, // S: standing col, Z-axis
    { name: 'back',     indices: [0, 3, 6], applyOri: FLOPPY_APPLY_RZ }, // B: back col, Z-axis
];

function getFloppyOrientation(quaternion) {
    const q = quaternion;
    const absW = Math.abs(q.w);
    const absX = Math.abs(q.x);
    const absY = Math.abs(q.y);
    const absZ = Math.abs(q.z);
    const max = Math.max(absW, absX, absY, absZ);
    if (max === absW) return 0; // Identity
    if (max === absX) return 1; // Rx (180° around X)
    if (max === absY) return 2; // Ry (180° around Y)
    return 3;                   // Rz (180° around Z)
}

function getFloppyState() {
    const state = new Array(9);
    const isMirror = cubeState.figure === 'mirror';
    const unit = CUBIE_SIZE * 2 + GAP;

    cubeState.cubies.forEach(function(cubie) {
        // Piece identity from original grid position
        const gp = cubie.userData.gridPos;
        const pieceId = gp.y * 3 + gp.z;

        // Current 3D position -> current grid index
        let curY, curZ;
        if (isMirror) {
            // Find closest match in mirrorPosY/mirrorPosZ arrays
            let bestY = 0, bestDistY = Infinity;
            for (let r = 0; r < 3; r++) {
                const d = Math.abs(cubie.position.y - cubeState.mirrorPosY[r]);
                if (d < bestDistY) { bestDistY = d; bestY = r; }
            }
            let bestZ = 0, bestDistZ = Infinity;
            for (let c = 0; c < 3; c++) {
                const d = Math.abs(cubie.position.z - cubeState.mirrorPosZ[c]);
                if (d < bestDistZ) { bestDistZ = d; bestZ = c; }
            }
            curY = bestY;
            curZ = bestZ;
        } else {
            // Block figure: standard grid spacing
            curY = Math.round(cubie.position.y / unit) + 1;
            curZ = Math.round(cubie.position.z / unit) + 1;
        }

        const curIndex = curY * 3 + curZ;
        const ori = getFloppyOrientation(cubie.quaternion);
        state[curIndex] = pieceId * 4 + ori;
    });

    return state;
}

function applyFloppyMove(state, moveIndex) {
    const move = FLOPPY_MOVES[moveIndex];
    const idx = move.indices;
    const applyOri = move.applyOri;

    // 180° swap: first and last swap, middle stays
    const newState = state.slice();
    // Swap positions of first and last in the row/col
    newState[idx[0]] = state[idx[2]];
    newState[idx[2]] = state[idx[0]];
    // Middle stays in place (but orientation still changes)

    // Apply orientation change to all three affected pieces
    for (let i = 0; i < 3; i++) {
        const val = newState[idx[i]];
        const pid = Math.floor(val / 4);
        const ori = val % 4;
        newState[idx[i]] = pid * 4 + applyOri[ori];
    }

    return newState;
}

function solveFloppyCube() {
    const startState = getFloppyState();
    const isMirror = cubeState.figure === 'mirror';

    // Goal check function
    function isGoal(state) {
        if (isMirror) {
            // Mirror: only positions must match (ignore orientation)
            for (let i = 0; i < 9; i++) {
                if (Math.floor(state[i] / 4) !== i) return false;
            }
            return true;
        } else {
            // Block: positions AND orientations must match
            for (let i = 0; i < 9; i++) {
                if (state[i] !== i * 4) return false;
            }
            return true;
        }
    }

    // State key for visited set
    function stateKey(state) {
        if (isMirror) {
            // Position-only key
            const parts = [];
            for (let i = 0; i < 9; i++) parts.push(Math.floor(state[i] / 4));
            return parts.join(',');
        }
        return state.join(',');
    }

    if (isGoal(startState)) return [];

    // BFS
    const visited = {};
    const queue = [{ state: startState, moves: [] }];
    visited[stateKey(startState)] = true;

    while (queue.length > 0) {
        const current = queue.shift();

        for (let m = 0; m < 6; m++) {
            const newState = applyFloppyMove(current.state, m);
            const key = stateKey(newState);

            if (visited[key]) continue;
            visited[key] = true;

            const newMoves = current.moves.concat([m]);

            if (isGoal(newState)) {
                return newMoves.map(function(i) { return FLOPPY_MOVES[i].name; });
            }

            queue.push({ state: newState, moves: newMoves });
        }
    }

    return null; // No solution found (shouldn't happen)
}

function solveFromHistory(onComplete) {
    const reversedMoves = moveHistory.slice().reverse();
    moveHistory = [];
    isSolving = true;

    let index = 0;
    function next() {
        if (index >= reversedMoves.length) {
            isSolving = false;
            if (onComplete) onComplete();
            return;
        }
        const move = reversedMoves[index++];
        if (move.type === 'pyraminx') {
            rotatePyraminxLayer(move.face, !move.clockwise, move.wide, next);
        } else if (move.type === 'sq1') {
            if (move.move === 'slice') {
                sliceSQ1(next);
            } else {
                rotateSQ1Layer(move.move, -move.amount, next);
            }
        } else {
            rotateCubeLayer(move.face, !move.clockwise, next);
        }
    }
    next();
}

function executeFloppySolution(moves, onComplete) {
    if (!moves || moves.length === 0) {
        if (onComplete) onComplete();
        return;
    }

    let index = 0;
    function executeNext() {
        if (index >= moves.length) {
            if (onComplete) onComplete();
            return;
        }
        const face = moves[index++];
        rotateCubeLayer(face, true, executeNext);
    }

    executeNext();
}
