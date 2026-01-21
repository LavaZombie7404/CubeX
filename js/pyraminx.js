const PYRAMINX_COLORS = {
    front: 0xe94560,    // red
    right: 0x4ecca3,    // green
    left: 0x3498db,     // blue
    bottom: 0xf1c40f    // yellow
};

// Regular tetrahedron vertices (edge length = 1)
// Centered at origin
const EDGE = 1.5;
const VERTICES = {
    top: new THREE.Vector3(0, EDGE * Math.sqrt(2/3), 0),
    frontLeft: new THREE.Vector3(-EDGE/2, -EDGE * Math.sqrt(2/3) / 3, EDGE * Math.sqrt(3) / 6),
    frontRight: new THREE.Vector3(EDGE/2, -EDGE * Math.sqrt(2/3) / 3, EDGE * Math.sqrt(3) / 6),
    back: new THREE.Vector3(0, -EDGE * Math.sqrt(2/3) / 3, -EDGE * Math.sqrt(3) / 3)
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

    faces.forEach(face => {
        const triangles = subdivideFace(face.v[0], face.v[1], face.v[2], 3);

        triangles.forEach((tri, index) => {
            const mesh = createTriangleMesh(tri, face.color);

            // Calculate center of triangle for layer assignment
            const center = new THREE.Vector3(
                (tri[0].x + tri[1].x + tri[2].x) / 3,
                (tri[0].y + tri[1].y + tri[2].y) / 3,
                (tri[0].z + tri[1].z + tri[2].z) / 3
            );

            mesh.userData = {
                face: face.name,
                index: index,
                center: center,
                layers: assignLayers(center)
            };

            pyraminxState.pieces.push(mesh);
            pyraminxState.group.add(mesh);
        });
    });

    return pyraminxState.group;
}

function assignLayers(center) {
    const layers = [];
    const threshold = EDGE * 0.4;

    if (center.distanceTo(VERTICES.top) < threshold) layers.push('top');
    if (center.distanceTo(VERTICES.frontLeft) < threshold) layers.push('left');
    if (center.distanceTo(VERTICES.frontRight) < threshold) layers.push('right');
    if (center.distanceTo(VERTICES.back) < threshold) layers.push('back');

    return layers;
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

            // Pointing down triangle
            triangles.push([top, bottomLeft, bottomRight]);

            // Pointing up triangle (inverted)
            if (col < row) {
                const tPlusNext = (col + 1) / row;
                const topRight = rowStart0.clone().lerp(rowStart1, tPlusNext);
                triangles.push([bottomRight, topRight, top]);
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
        side: THREE.FrontSide
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

function rotatePyraminxLayer(layerName, clockwise, onComplete) {
    if (pyraminxState.isAnimating) {
        pyraminxState.animationQueue.push({ layerName, clockwise, onComplete });
        return;
    }

    const axis = AXES[layerName];
    const pivot = PIVOTS[layerName];
    const angle = clockwise ? -2 * Math.PI / 3 : 2 * Math.PI / 3;

    const layerPieces = pyraminxState.pieces.filter(p =>
        p.userData.layers.includes(layerName)
    );

    if (layerPieces.length === 0) return;

    pyraminxState.isAnimating = true;

    animateRotation(layerPieces, pivot, axis, angle, 300, function() {
        pyraminxState.isAnimating = false;

        if (onComplete) onComplete();

        if (pyraminxState.animationQueue.length > 0) {
            const next = pyraminxState.animationQueue.shift();
            rotatePyraminxLayer(next.layerName, next.clockwise, next.onComplete);
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
                piece.userData.layers = assignLayers(center);
            });

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

        switch(key) {
            case 'u':
                rotatePyraminxLayer('top', !shift);
                break;
            case 'l':
                rotatePyraminxLayer('left', !shift);
                break;
            case 'r':
                rotatePyraminxLayer('right', !shift);
                break;
            case 'b':
                rotatePyraminxLayer('back', !shift);
                break;
        }
    });
}
