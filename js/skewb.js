// ==================== Skewb Puzzle ====================

var skewbState = {
    group: null,
    pieces: [],        // { type:'corner'|'center', id, cornerId/centerId, mesh }
    isAnimating: false,
    animationQueue: []
};

var SKEWB_S = 0.6;   // half-size of the cube

var SKEWB_COLORS = {
    U: 0xffffff,    // white  (top)
    D: 0xffff00,    // yellow (bottom)
    F: 0xff0000,    // red    (front)
    B: 0xffa500,    // orange (back)
    L: 0x00ff00,    // green  (left)
    R: 0x0000ff,    // blue   (right)
    dark: 0x111111
};

// The 8 corner positions of the cube
var SKEWB_CORNERS = [
    { id: 'FRU', pos: [ 1,  1,  1] },
    { id: 'FLU', pos: [-1,  1,  1] },
    { id: 'BRU', pos: [ 1,  1, -1] },
    { id: 'BLU', pos: [-1,  1, -1] },
    { id: 'FRD', pos: [ 1, -1,  1] },
    { id: 'FLD', pos: [-1, -1,  1] },
    { id: 'BRD', pos: [ 1, -1, -1] },
    { id: 'BLD', pos: [-1, -1, -1] }
];

// The 6 center faces
var SKEWB_CENTERS = [
    { id: 'U', normal: [0, 1, 0], face: 'U' },
    { id: 'D', normal: [0,-1, 0], face: 'D' },
    { id: 'F', normal: [0, 0, 1], face: 'F' },
    { id: 'B', normal: [0, 0,-1], face: 'B' },
    { id: 'R', normal: [ 1, 0, 0], face: 'R' },
    { id: 'L', normal: [-1, 0, 0], face: 'L' }
];

// Move definitions: each move rotates one half of the puzzle 120° around a body diagonal.
// corners[0] is the pivot corner.
var SKEWB_MOVES = {
    R: {
        axis: [-1, 1, -1],
        corners: ['FRD', 'FRU', 'BRD', 'FLD'],
        centers: ['F', 'R', 'D']
    },
    L: {
        axis: [1, 1, -1],
        corners: ['FLD', 'FLU', 'BLD', 'FRD'],
        centers: ['F', 'L', 'D']
    },
    U: {
        axis: [1, -1, 1],
        corners: ['BLU', 'FLU', 'BRU', 'BLD'],
        centers: ['U', 'L', 'B']
    },
    B: {
        axis: [-1, 1, 1],
        corners: ['BRD', 'BRU', 'BLD', 'FRD'],
        centers: ['B', 'R', 'D']
    }
};

// Helper: add a triangle to the vertex array with correct winding for the given outward normal.
function addTriWithNormal(verts, a, b, c, nx, ny, nz) {
    // Compute (b-a) × (c-a)
    var abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
    var acx = c[0]-a[0], acy = c[1]-a[1], acz = c[2]-a[2];
    var crossX = aby*acz - abz*acy;
    var crossY = abz*acx - abx*acz;
    var crossZ = abx*acy - aby*acx;
    var dot = crossX*nx + crossY*ny + crossZ*nz;
    if (dot >= 0) {
        verts.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
    } else {
        verts.push(a[0],a[1],a[2], c[0],c[1],c[2], b[0],b[1],b[2]);
    }
}

// Build a corner piece mesh (tetrahedron at a cube corner).
// 3 visible colored faces + 1 dark internal face.
function createSkewbCorner(cornerDef) {
    var S = SKEWB_S;
    var T = 2 * S / 3;  // 1/3 of edge length (distance from corner to cut point)
    var sx = cornerDef.pos[0];  // ±1
    var sy = cornerDef.pos[1];
    var sz = cornerDef.pos[2];

    // v0 = cube corner
    var v0 = [sx*S, sy*S, sz*S];
    // v1 = cut point along X edge
    var v1 = [sx*S - sx*T, sy*S, sz*S];
    // v2 = cut point along Y edge
    var v2 = [sx*S, sy*S - sy*T, sz*S];
    // v3 = cut point along Z edge
    var v3 = [sx*S, sy*S, sz*S - sz*T];

    var geometry = new THREE.BufferGeometry();
    var vertices = [];
    var groups = [];

    // Face 0: Y-normal face (U or D) — triangle on v0, v1, v3 (all at y = sy*S)
    addTriWithNormal(vertices, v0, v1, v3, 0, sy, 0);
    groups.push({ start: 0, count: 3, materialIndex: 0 });

    // Face 1: Z-normal face (F or B) — triangle on v0, v1, v2 (all at z = sz*S)
    addTriWithNormal(vertices, v0, v1, v2, 0, 0, sz);
    groups.push({ start: 3, count: 3, materialIndex: 1 });

    // Face 2: X-normal face (R or L) — triangle on v0, v2, v3 (all at x = sx*S)
    addTriWithNormal(vertices, v0, v2, v3, sx, 0, 0);
    groups.push({ start: 6, count: 3, materialIndex: 2 });

    // Face 3: Internal cut face — triangle v1, v2, v3
    // Normal points inward (toward center of cube, which is origin)
    var cx = (v1[0]+v2[0]+v3[0])/3;
    var cy = (v1[1]+v2[1]+v3[1])/3;
    var cz = (v1[2]+v2[2]+v3[2])/3;
    addTriWithNormal(vertices, v1, v2, v3, -cx, -cy, -cz);
    groups.push({ start: 9, count: 3, materialIndex: 3 });

    var posArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.computeVertexNormals();

    geometry.clearGroups();
    for (var g = 0; g < groups.length; g++) {
        geometry.addGroup(groups[g].start, groups[g].count, groups[g].materialIndex);
    }

    var yFace = sy > 0 ? 'U' : 'D';
    var zFace = sz > 0 ? 'F' : 'B';
    var xFace = sx > 0 ? 'R' : 'L';

    var materials = [
        new THREE.MeshLambertMaterial({ color: SKEWB_COLORS[yFace], side: THREE.DoubleSide }),
        new THREE.MeshLambertMaterial({ color: SKEWB_COLORS[zFace], side: THREE.DoubleSide }),
        new THREE.MeshLambertMaterial({ color: SKEWB_COLORS[xFace], side: THREE.DoubleSide }),
        new THREE.MeshLambertMaterial({ color: SKEWB_COLORS.dark, side: THREE.DoubleSide })
    ];

    var mesh = new THREE.Mesh(geometry, materials);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 20);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

// Build a center piece mesh (octagon on a cube face).
function createSkewbCenter(centerDef) {
    var S = SKEWB_S;
    var T = S / 3;
    var face = centerDef.face;
    var n = centerDef.normal;

    // The center piece is an octagon on the face, formed by the 8 cut points.
    // For each face, the octagon vertices lie on the face plane.
    var octVerts;
    if (face === 'U') {
        octVerts = [
            [ T, S, S], [ S, S, T], [ S, S,-T], [ T, S,-S],
            [-T, S,-S], [-S, S,-T], [-S, S, T], [-T, S, S]
        ];
    } else if (face === 'D') {
        octVerts = [
            [ T,-S, S], [ S,-S, T], [ S,-S,-T], [ T,-S,-S],
            [-T,-S,-S], [-S,-S,-T], [-S,-S, T], [-T,-S, S]
        ];
    } else if (face === 'F') {
        octVerts = [
            [ T, S, S], [ S, T, S], [ S,-T, S], [ T,-S, S],
            [-T,-S, S], [-S,-T, S], [-S, T, S], [-T, S, S]
        ];
    } else if (face === 'B') {
        octVerts = [
            [-T, S,-S], [-S, T,-S], [-S,-T,-S], [-T,-S,-S],
            [ T,-S,-S], [ S,-T,-S], [ S, T,-S], [ T, S,-S]
        ];
    } else if (face === 'R') {
        octVerts = [
            [S, T, S], [S, S, T], [S, S,-T], [S, T,-S],
            [S,-T,-S], [S,-S,-T], [S,-S, T], [S,-T, S]
        ];
    } else { // L
        octVerts = [
            [-S, T, S], [-S, S, T], [-S, S,-T], [-S, T,-S],
            [-S,-T,-S], [-S,-S,-T], [-S,-S, T], [-S,-T, S]
        ];
    }

    // Fan-triangulate from the face center
    var fc = [n[0]*S, n[1]*S, n[2]*S];
    var geometry = new THREE.BufferGeometry();
    var vertices = [];

    for (var i = 0; i < 8; i++) {
        var next = (i + 1) % 8;
        addTriWithNormal(vertices, fc, octVerts[i], octVerts[next], n[0], n[1], n[2]);
    }

    var posArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.computeVertexNormals();

    var material = new THREE.MeshLambertMaterial({ color: SKEWB_COLORS[face], side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geometry, material);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 20);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

function createSkewb() {
    skewbState.group = new THREE.Group();
    skewbState.pieces = [];
    skewbState.isAnimating = false;
    skewbState.animationQueue = [];

    var idCounter = 0;

    // Create 8 corner pieces
    for (var i = 0; i < SKEWB_CORNERS.length; i++) {
        var def = SKEWB_CORNERS[i];
        var mesh = createSkewbCorner(def);
        skewbState.pieces.push({
            type: 'corner', id: idCounter++, cornerId: def.id, mesh: mesh
        });
        skewbState.group.add(mesh);
    }

    // Create 6 center pieces
    for (var i = 0; i < SKEWB_CENTERS.length; i++) {
        var def = SKEWB_CENTERS[i];
        var mesh = createSkewbCenter(def);
        skewbState.pieces.push({
            type: 'center', id: idCounter++, centerId: def.id, mesh: mesh
        });
        skewbState.group.add(mesh);
    }

    return skewbState.group;
}

// Find pieces that participate in a given move
function getMovePieces(moveName) {
    var moveDef = SKEWB_MOVES[moveName];
    var pieces = [];
    for (var i = 0; i < skewbState.pieces.length; i++) {
        var p = skewbState.pieces[i];
        if (p.type === 'corner' && moveDef.corners.indexOf(p.cornerId) >= 0) {
            pieces.push(p);
        } else if (p.type === 'center' && moveDef.centers.indexOf(p.centerId) >= 0) {
            pieces.push(p);
        }
    }
    return pieces;
}

function rotateSkewbMove(moveName, clockwise, onComplete) {
    if (skewbState.isAnimating) {
        skewbState.animationQueue.push({ move: moveName, clockwise: clockwise, onComplete: onComplete });
        return;
    }

    skewbState.isAnimating = true;

    if (!isSolving) {
        moveHistory.push({ type: 'skewb', move: moveName, clockwise: clockwise });
    }

    var moveDef = SKEWB_MOVES[moveName];
    var axisVec = new THREE.Vector3(moveDef.axis[0], moveDef.axis[1], moveDef.axis[2]).normalize();
    var angle = clockwise ? -2 * Math.PI / 3 : 2 * Math.PI / 3;

    var movePieces = getMovePieces(moveName);

    var startPositions = [];
    var startQuaternions = [];
    for (var i = 0; i < movePieces.length; i++) {
        startPositions.push(movePieces[i].mesh.position.clone());
        startQuaternions.push(movePieces[i].mesh.quaternion.clone());
    }

    var duration = 300;
    var startTime = performance.now();

    function animate() {
        var elapsed = performance.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        var currentAngle = angle * eased;
        var rotQuat = new THREE.Quaternion();
        rotQuat.setFromAxisAngle(axisVec, currentAngle);

        for (var i = 0; i < movePieces.length; i++) {
            movePieces[i].mesh.position.copy(startPositions[i]).applyQuaternion(rotQuat);
            movePieces[i].mesh.quaternion.copy(startQuaternions[i]).premultiply(rotQuat);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            updatePieceIds(moveName, clockwise);
            skewbState.isAnimating = false;
            if (onComplete) onComplete();
            processNextSkewbAnimation();
        }
    }

    animate();
}

// After a move, cycle the logical IDs of the 3 non-pivot corners and 3 centers.
function updatePieceIds(moveName, clockwise) {
    var moveDef = SKEWB_MOVES[moveName];
    var cycleCornerIds = [moveDef.corners[1], moveDef.corners[2], moveDef.corners[3]];
    var cycleCenterIds = [moveDef.centers[0], moveDef.centers[1], moveDef.centers[2]];

    function findPieceByCorner(id) {
        for (var j = 0; j < skewbState.pieces.length; j++) {
            if (skewbState.pieces[j].cornerId === id) return skewbState.pieces[j];
        }
        return null;
    }
    function findPieceByCenter(id) {
        for (var j = 0; j < skewbState.pieces.length; j++) {
            if (skewbState.pieces[j].centerId === id) return skewbState.pieces[j];
        }
        return null;
    }

    var cp = [findPieceByCorner(cycleCornerIds[0]), findPieceByCorner(cycleCornerIds[1]), findPieceByCorner(cycleCornerIds[2])];
    var cep = [findPieceByCenter(cycleCenterIds[0]), findPieceByCenter(cycleCenterIds[1]), findPieceByCenter(cycleCenterIds[2])];

    if (clockwise) {
        var t1 = cp[2].cornerId; cp[2].cornerId = cp[1].cornerId; cp[1].cornerId = cp[0].cornerId; cp[0].cornerId = t1;
        var t2 = cep[2].centerId; cep[2].centerId = cep[1].centerId; cep[1].centerId = cep[0].centerId; cep[0].centerId = t2;
    } else {
        var t1 = cp[0].cornerId; cp[0].cornerId = cp[1].cornerId; cp[1].cornerId = cp[2].cornerId; cp[2].cornerId = t1;
        var t2 = cep[0].centerId; cep[0].centerId = cep[1].centerId; cep[1].centerId = cep[2].centerId; cep[2].centerId = t2;
    }
}

function processNextSkewbAnimation() {
    if (skewbState.animationQueue.length > 0) {
        var next = skewbState.animationQueue.shift();
        rotateSkewbMove(next.move, next.clockwise, next.onComplete);
    }
}

function scrambleSkewb(moveCount, onComplete) {
    moveCount = moveCount || 15;
    var moveNames = ['R', 'L', 'U', 'B'];
    var moves = [];
    var lastMove = null;

    for (var i = 0; i < moveCount; i++) {
        var move;
        do {
            move = moveNames[Math.floor(Math.random() * moveNames.length)];
        } while (move === lastMove);
        lastMove = move;
        moves.push({ move: move, clockwise: Math.random() < 0.5 });
    }

    var index = 0;
    function executeNext() {
        if (index >= moves.length) {
            if (onComplete) onComplete();
            return;
        }
        var m = moves[index++];
        rotateSkewbMove(m.move, m.clockwise, executeNext);
    }
    executeNext();
}

function setupSkewbControls() {
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        if (typeof currentPuzzle === 'undefined' || currentPuzzle !== 'skewb') return;
        if (skewbState.isAnimating) return;

        var key = e.key.toLowerCase();
        var clockwise = !e.shiftKey;

        switch (key) {
            case 'r':
                e.preventDefault();
                rotateSkewbMove('R', clockwise);
                break;
            case 'l':
                e.preventDefault();
                rotateSkewbMove('L', clockwise);
                break;
            case 'u':
                e.preventDefault();
                rotateSkewbMove('U', clockwise);
                break;
            case 'b':
                e.preventDefault();
                rotateSkewbMove('B', clockwise);
                break;
        }
    });
}
