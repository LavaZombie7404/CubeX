const PYRAMINX_COLORS = {
    front: 0xe94560,    // red
    right: 0x4ecca3,    // green
    left: 0x3498db,     // blue
    bottom: 0xf1c40f    // yellow
};

// Regular tetrahedron vertices (edge length = EDGE)
// Centered at origin with one vertex pointing up
const EDGE = 1.5;
const H = EDGE * Math.sqrt(2/3);  // height of regular tetrahedron
const VERTICES = {
    top: new THREE.Vector3(0, H * 3/4, 0),
    frontLeft: new THREE.Vector3(-EDGE/2, -H / 4, EDGE * Math.sqrt(3) / 6),
    frontRight: new THREE.Vector3(EDGE/2, -H / 4, EDGE * Math.sqrt(3) / 6),
    back: new THREE.Vector3(0, -H / 4, -EDGE * Math.sqrt(3) / 3)
};

// Center of tetrahedron
const CENTER = new THREE.Vector3(0, 0, 0);

// Rotation axes - from center through each vertex (outward)
const AXES = {
    top: VERTICES.top.clone().normalize(),
    left: VERTICES.frontLeft.clone().normalize(),
    right: VERTICES.frontRight.clone().normalize(),
    back: VERTICES.back.clone().normalize()
};

// Pivot points for rotations (at tips)
const PIVOTS = {
    top: VERTICES.top.clone(),
    left: VERTICES.frontLeft.clone(),
    right: VERTICES.frontRight.clone(),
    back: VERTICES.back.clone()
};

var pyraminxState = {
    group: null,
    pieces: [],
    isAnimating: false,
    animationQueue: []
};

function createPyraminx() {
    pyraminxState.group = new THREE.Group();
    pyraminxState.pieces = [];

    // Face definitions with correct winding order (counter-clockwise when viewed from outside)
    const faces = [
        { v: [VERTICES.top, VERTICES.frontRight, VERTICES.frontLeft], color: PYRAMINX_COLORS.front, name: 'front' },
        { v: [VERTICES.top, VERTICES.back, VERTICES.frontRight], color: PYRAMINX_COLORS.right, name: 'right' },
        { v: [VERTICES.top, VERTICES.frontLeft, VERTICES.back], color: PYRAMINX_COLORS.left, name: 'left' },
        { v: [VERTICES.frontLeft, VERTICES.frontRight, VERTICES.back], color: PYRAMINX_COLORS.bottom, name: 'bottom' }
    ];

    // Map face vertex positions to layer names
    const vertexToLayer = new Map([
        [VERTICES.top, 'top'],
        [VERTICES.frontLeft, 'left'],
        [VERTICES.frontRight, 'right'],
        [VERTICES.back, 'back']
    ]);

    faces.forEach(face => {
        const triangles = subdivideFace(face.v[0], face.v[1], face.v[2], 3);
        const v0Layer = vertexToLayer.get(face.v[0]);

        triangles.forEach((tri, index) => {
            const mesh = createTriangleMesh(tri.verts, face.color);

            // Calculate center of triangle for layer assignment
            const center = new THREE.Vector3(
                (tri.verts[0].x + tri.verts[1].x + tri.verts[2].x) / 3,
                (tri.verts[0].y + tri.verts[1].y + tri.verts[2].y) / 3,
                (tri.verts[0].z + tri.verts[1].z + tri.verts[2].z) / 3
            );

            // Row-based layer assignment for the face's primary vertex (v0)
            // Row 0 = tip only, Row 0-1 = wide layer (4 small tetrahedra)
            const layers = [];
            const wideLayers = [];

            if (tri.row === 0) {
                layers.push(v0Layer);
            }
            if (tri.row <= 1) {
                wideLayers.push(v0Layer);
            }

            mesh.userData = {
                face: face.name,
                index: index,
                center: center,
                row: tri.row,
                layers: layers,
                wideLayers: wideLayers
            };

            pyraminxState.pieces.push(mesh);
            pyraminxState.group.add(mesh);
        });
    });

    return pyraminxState.group;
}

// Opposite face centers (center of the face opposite to each vertex)
const OPPOSITE_FACE_CENTERS = {
    top: new THREE.Vector3().addVectors(VERTICES.frontLeft, VERTICES.frontRight).add(VERTICES.back).divideScalar(3),
    left: new THREE.Vector3().addVectors(VERTICES.top, VERTICES.frontRight).add(VERTICES.back).divideScalar(3),
    right: new THREE.Vector3().addVectors(VERTICES.top, VERTICES.frontLeft).add(VERTICES.back).divideScalar(3),
    back: new THREE.Vector3().addVectors(VERTICES.top, VERTICES.frontLeft).add(VERTICES.frontRight).divideScalar(3)
};

function assignLayers(center) {
    const layers = [];
    const wideLayers = [];
    const tipThreshold = EDGE * 0.25;   // tip only

    // Check each vertex
    const vertexChecks = [
        { vertex: VERTICES.top, opposite: OPPOSITE_FACE_CENTERS.top, name: 'top' },
        { vertex: VERTICES.frontLeft, opposite: OPPOSITE_FACE_CENTERS.left, name: 'left' },
        { vertex: VERTICES.frontRight, opposite: OPPOSITE_FACE_CENTERS.right, name: 'right' },
        { vertex: VERTICES.back, opposite: OPPOSITE_FACE_CENTERS.back, name: 'back' }
    ];

    vertexChecks.forEach(({ vertex, opposite, name }) => {
        // Tip layer: simple distance check
        if (center.distanceTo(vertex) < tipThreshold) {
            layers.push(name);
        }

        // Wide layer: check if center is in the inner 2/3 from vertex toward opposite face
        // Project center onto axis from vertex to opposite face center
        const axisVec = opposite.clone().sub(vertex);
        const centerVec = center.clone().sub(vertex);
        const projection = centerVec.dot(axisVec) / axisVec.lengthSq();

        // projection = 0 at vertex, 1 at opposite face center
        // Wide layer includes rows 0-1 out of 3, so projection < 2/3
        if (projection < 2/3) {
            wideLayers.push(name);
        }
    });

    return { layers, wideLayers };
}

function subdivideFace(v0, v1, v2, divisions) {
    const triangles = [];

    for (let row = 0; row < divisions; row++) {
        const rowStart0 = v0.clone().lerp(v1, row / divisions);
        const rowStart1 = v0.clone().lerp(v2, row / divisions);
        const nextRowStart0 = v0.clone().lerp(v1, (row + 1) / divisions);
        const nextRowStart1 = v0.clone().lerp(v2, (row + 1) / divisions);

        for (let col = 0; col <= row; col++) {
            const t = row === 0 ? 0 : col / row;
            const tNext = col / (row + 1);
            const tNextPlus = (col + 1) / (row + 1);

            const top = rowStart0.clone().lerp(rowStart1, t);
            const bottomLeft = nextRowStart0.clone().lerp(nextRowStart1, tNext);
            const bottomRight = nextRowStart0.clone().lerp(nextRowStart1, tNextPlus);

            // Pointing down triangle (vertices ordered to match parent face winding)
            // row 0 = tip, row 1 = adjacent to tip
            triangles.push({ verts: [top, bottomRight, bottomLeft], row: row });

            // Pointing up triangle (inverted, same winding direction)
            if (col < row) {
                const tPlusNext = (col + 1) / row;
                const topRight = rowStart0.clone().lerp(rowStart1, tPlusNext);
                // Up-pointing triangles in row N are still part of row N
                triangles.push({ verts: [bottomRight, top, topRight], row: row });
            }
        }
    }

    return triangles;
}

function createTriangleMesh(vertices, color) {
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array([
        vertices[0].x, vertices[0].y, vertices[0].z,
        vertices[1].x, vertices[1].y, vertices[1].z,
        vertices[2].x, vertices[2].y, vertices[2].z
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
        color: color,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    mesh.add(line);

    return mesh;
}

function rotatePyraminxLayer(layerName, clockwise, wide, onComplete) {
    if (pyraminxState.isAnimating) {
        pyraminxState.animationQueue.push({ layerName, clockwise, wide, onComplete });
        return;
    }

    const axis = AXES[layerName];
    const pivot = PIVOTS[layerName];
    const angle = clockwise ? -2 * Math.PI / 3 : 2 * Math.PI / 3;

    const layerKey = wide ? 'wideLayers' : 'layers';
    const layerPieces = pyraminxState.pieces.filter(p =>
        p.userData[layerKey].includes(layerName)
    );

    if (layerPieces.length === 0) return;

    pyraminxState.isAnimating = true;

    animateRotation(layerPieces, pivot, axis, angle, 300, function() {
        pyraminxState.isAnimating = false;

        if (onComplete) onComplete();

        if (pyraminxState.animationQueue.length > 0) {
            const next = pyraminxState.animationQueue.shift();
            rotatePyraminxLayer(next.layerName, next.clockwise, next.wide, next.onComplete);
        }
    });
}

function animateRotation(pieces, pivot, axis, targetAngle, duration, onComplete) {
    const startTime = performance.now();

    const startVertices = pieces.map(piece => {
        const posAttr = piece.geometry.getAttribute('position');
        const verts = [];
        for (let j = 0; j < posAttr.count; j++) {
            verts.push(new THREE.Vector3(
                posAttr.getX(j),
                posAttr.getY(j),
                posAttr.getZ(j)
            ));
        }
        return verts;
    });

    function update() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentAngle = targetAngle * eased;

        pieces.forEach((piece, i) => {
            const posAttr = piece.geometry.getAttribute('position');

            for (let j = 0; j < posAttr.count; j++) {
                const vert = startVertices[i][j].clone();
                vert.sub(pivot);
                vert.applyAxisAngle(axis, currentAngle);
                vert.add(pivot);
                posAttr.setXYZ(j, vert.x, vert.y, vert.z);
            }

            posAttr.needsUpdate = true;
            piece.geometry.computeVertexNormals();

            if (piece.children[0]) {
                piece.children[0].geometry.dispose();
                piece.children[0].geometry = new THREE.EdgesGeometry(piece.geometry);
            }
        });

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            pieces.forEach(piece => {
                const posAttr = piece.geometry.getAttribute('position');
                const center = new THREE.Vector3(
                    (posAttr.getX(0) + posAttr.getX(1) + posAttr.getX(2)) / 3,
                    (posAttr.getY(0) + posAttr.getY(1) + posAttr.getY(2)) / 3,
                    (posAttr.getZ(0) + posAttr.getZ(1) + posAttr.getZ(2)) / 3
                );
                piece.userData.center = center;
                const layerAssignment = assignLayers(center);
                piece.userData.layers = layerAssignment.layers;
                piece.userData.wideLayers = layerAssignment.wideLayers;
            });

            // Update 2D diagram
            if (typeof updatePyraminxDiagram === 'function') {
                updatePyraminxDiagram();
            }

            if (onComplete) onComplete();
        }
    }

    update();
}

function setupPyraminxControls() {
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;

        const key = e.key.toLowerCase();
        const shift = e.shiftKey;
        const ctrl = e.ctrlKey;
        const clockwise = !shift;

        switch(key) {
            case 'u':
                e.preventDefault();
                rotatePyraminxLayer('top', clockwise, ctrl);
                break;
            case 'l':
                e.preventDefault();
                rotatePyraminxLayer('left', clockwise, ctrl);
                break;
            case 'r':
                e.preventDefault();
                rotatePyraminxLayer('right', clockwise, ctrl);
                break;
            case 'b':
                e.preventDefault();
                rotatePyraminxLayer('back', clockwise, ctrl);
                break;
        }
    });
}
