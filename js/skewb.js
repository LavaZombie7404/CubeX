// ==================== Skewb Puzzle ====================

var skewbState = {
    group: null,
    pieces: [],        // { type:'corner'|'center', id, cornerId/centerId, meshes:[] }
    body: null,
    isAnimating: false,
    animationQueue: []
};

var SKEWB_S = 0.6;       // half-size of the cube
var SKEWB_GAP = 0.015;   // gap between stickers
var SKEWB_RAISE = 0.003; // sticker raise above body

var SKEWB_COLORS = {
    U: 0xffffff,    // white
    D: 0xffff00,    // yellow
    F: 0xff0000,    // red
    B: 0xffa500,    // orange
    L: 0x00ff00,    // green
    R: 0x0000ff,    // blue
    dark: 0x222222
};

// Move definitions: each move rotates one half (4 corners + 3 centers) 120° around a body diagonal.
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

// Corner definitions: id, signs for position
var SKEWB_CORNER_DEFS = [
    { id: 'FRU', sx: 1, sy: 1, sz: 1 },
    { id: 'FLU', sx:-1, sy: 1, sz: 1 },
    { id: 'BRU', sx: 1, sy: 1, sz:-1 },
    { id: 'BLU', sx:-1, sy: 1, sz:-1 },
    { id: 'FRD', sx: 1, sy:-1, sz: 1 },
    { id: 'FLD', sx:-1, sy:-1, sz: 1 },
    { id: 'BRD', sx: 1, sy:-1, sz:-1 },
    { id: 'BLD', sx:-1, sy:-1, sz:-1 }
];

// Center definitions
var SKEWB_CENTER_DEFS = [
    { id: 'U', nx: 0, ny: 1, nz: 0 },
    { id: 'D', nx: 0, ny:-1, nz: 0 },
    { id: 'F', nx: 0, ny: 0, nz: 1 },
    { id: 'B', nx: 0, ny: 0, nz:-1 },
    { id: 'R', nx: 1, ny: 0, nz: 0 },
    { id: 'L', nx:-1, ny: 0, nz: 0 }
];

// Create a flat colored sticker mesh from an array of 3D points.
// Points should be coplanar and in order around the polygon.
// Normal is provided to ensure correct face orientation.
function createStickerMesh(points, color, nx, ny, nz) {
    var geometry = new THREE.BufferGeometry();
    var vertices = [];

    // Fan triangulation from first vertex
    for (var i = 1; i < points.length - 1; i++) {
        var a = points[0], b = points[i], c = points[i + 1];
        // Check winding
        var abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
        var acx = c[0]-a[0], acy = c[1]-a[1], acz = c[2]-a[2];
        var cx = aby*acz - abz*acy;
        var cy = abz*acx - abx*acz;
        var cz = abx*acy - aby*acx;
        var dot = cx*nx + cy*ny + cz*nz;
        if (dot >= 0) {
            vertices.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
        } else {
            vertices.push(a[0],a[1],a[2], c[0],c[1],c[2], b[0],b[1],b[2]);
        }
    }

    var posArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.computeVertexNormals();

    var material = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geometry, material);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 10);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

// Shrink polygon points toward centroid by gap amount
function shrinkPolygon(points, gap) {
    var cx = 0, cy = 0, cz = 0;
    for (var i = 0; i < points.length; i++) {
        cx += points[i][0]; cy += points[i][1]; cz += points[i][2];
    }
    cx /= points.length; cy /= points.length; cz /= points.length;

    var result = [];
    for (var i = 0; i < points.length; i++) {
        var dx = points[i][0] - cx, dy = points[i][1] - cy, dz = points[i][2] - cz;
        var len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len < 0.001) {
            result.push([points[i][0], points[i][1], points[i][2]]);
        } else {
            var shrink = Math.max(0, len - gap) / len;
            result.push([cx + dx*shrink, cy + dy*shrink, cz + dz*shrink]);
        }
    }
    return result;
}

// Raise polygon points along the face normal
function raisePolygon(points, nx, ny, nz, amount) {
    var result = [];
    for (var i = 0; i < points.length; i++) {
        result.push([
            points[i][0] + nx * amount,
            points[i][1] + ny * amount,
            points[i][2] + nz * amount
        ]);
    }
    return result;
}

// Get the face color name for a given axis direction
function getFaceFromNormal(nx, ny, nz) {
    if (ny > 0.5) return 'U';
    if (ny < -0.5) return 'D';
    if (nz > 0.5) return 'F';
    if (nz < -0.5) return 'B';
    if (nx > 0.5) return 'R';
    return 'L';
}

function createSkewb() {
    skewbState.group = new THREE.Group();
    skewbState.pieces = [];
    skewbState.isAnimating = false;
    skewbState.animationQueue = [];

    var S = SKEWB_S;
    var T = S / 3; // cut point: 1/3 of edge from corner

    // Dark body cube
    var bodyGeom = new THREE.BoxGeometry(2 * S, 2 * S, 2 * S);
    var bodyMat = new THREE.MeshLambertMaterial({ color: SKEWB_COLORS.dark });
    skewbState.body = new THREE.Mesh(bodyGeom, bodyMat);
    skewbState.group.add(skewbState.body);

    var idCounter = 0;

    // ---- Create 8 corner pieces ----
    // Each corner piece has 3 triangular stickers (one per adjacent face).
    for (var ci = 0; ci < SKEWB_CORNER_DEFS.length; ci++) {
        var cd = SKEWB_CORNER_DEFS[ci];
        var meshes = [];

        // The cube corner position
        var cx = cd.sx * S, cy = cd.sy * S, cz = cd.sz * S;

        // Cut points: 1/3 along each edge from the corner
        var vx = [cx - cd.sx * 2 * T, cy, cz]; // moved along X edge
        var vy = [cx, cy - cd.sy * 2 * T, cz]; // moved along Y edge
        var vz = [cx, cy, cz - cd.sz * 2 * T]; // moved along Z edge

        // Y-normal face sticker (U or D)
        var yPts = [[cx, cy, cz], vx, vz];
        var yFace = getFaceFromNormal(0, cd.sy, 0);
        yPts = shrinkPolygon(yPts, SKEWB_GAP);
        yPts = raisePolygon(yPts, 0, cd.sy, 0, SKEWB_RAISE);
        meshes.push(createStickerMesh(yPts, SKEWB_COLORS[yFace], 0, cd.sy, 0));

        // Z-normal face sticker (F or B)
        var zPts = [[cx, cy, cz], vx, vy];
        var zFace = getFaceFromNormal(0, 0, cd.sz);
        zPts = shrinkPolygon(zPts, SKEWB_GAP);
        zPts = raisePolygon(zPts, 0, 0, cd.sz, SKEWB_RAISE);
        meshes.push(createStickerMesh(zPts, SKEWB_COLORS[zFace], 0, 0, cd.sz));

        // X-normal face sticker (R or L)
        var xPts = [[cx, cy, cz], vy, vz];
        var xFace = getFaceFromNormal(cd.sx, 0, 0);
        xPts = shrinkPolygon(xPts, SKEWB_GAP);
        xPts = raisePolygon(xPts, cd.sx, 0, 0, SKEWB_RAISE);
        meshes.push(createStickerMesh(xPts, SKEWB_COLORS[xFace], cd.sx, 0, 0));

        // Add all meshes to group
        for (var m = 0; m < meshes.length; m++) {
            skewbState.group.add(meshes[m]);
        }

        skewbState.pieces.push({
            type: 'corner', id: idCounter++, cornerId: cd.id, meshes: meshes
        });
    }

    // ---- Create 6 center pieces ----
    // Each center piece is an octagonal sticker on a cube face.
    for (var fi = 0; fi < SKEWB_CENTER_DEFS.length; fi++) {
        var fd = SKEWB_CENTER_DEFS[fi];
        var face = fd.id;
        var nx = fd.nx, ny = fd.ny, nz = fd.nz;

        // Build octagon vertices on this face.
        // The center octagon is bounded by 4 cut lines, one from each face corner.
        // Each cut line connects two 1/3-points on adjacent edges.
        // The octagon has 8 vertices: 2 per face edge (one from each corner).
        var octPts;
        if (face === 'U') {
            octPts = [
                [T,S,S], [S,S,T], [S,S,-T], [T,S,-S],
                [-T,S,-S], [-S,S,-T], [-S,S,T], [-T,S,S]
            ];
        } else if (face === 'D') {
            octPts = [
                [T,-S,S], [S,-S,T], [S,-S,-T], [T,-S,-S],
                [-T,-S,-S], [-S,-S,-T], [-S,-S,T], [-T,-S,S]
            ];
        } else if (face === 'F') {
            octPts = [
                [T,S,S], [S,T,S], [S,-T,S], [T,-S,S],
                [-T,-S,S], [-S,-T,S], [-S,T,S], [-T,S,S]
            ];
        } else if (face === 'B') {
            octPts = [
                [-T,S,-S], [-S,T,-S], [-S,-T,-S], [-T,-S,-S],
                [T,-S,-S], [S,-T,-S], [S,T,-S], [T,S,-S]
            ];
        } else if (face === 'R') {
            octPts = [
                [S,T,S], [S,S,T], [S,S,-T], [S,T,-S],
                [S,-T,-S], [S,-S,-T], [S,-S,T], [S,-T,S]
            ];
        } else { // L
            octPts = [
                [-S,T,S], [-S,S,T], [-S,S,-T], [-S,T,-S],
                [-S,-T,-S], [-S,-S,-T], [-S,-S,T], [-S,-T,S]
            ];
        }

        octPts = shrinkPolygon(octPts, SKEWB_GAP);
        octPts = raisePolygon(octPts, nx, ny, nz, SKEWB_RAISE);

        var mesh = createStickerMesh(octPts, SKEWB_COLORS[face], nx, ny, nz);
        skewbState.group.add(mesh);

        skewbState.pieces.push({
            type: 'center', id: idCounter++, centerId: fd.id, meshes: [mesh]
        });
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

    // Collect all meshes for the moving pieces
    var allMeshes = [];
    var startPositions = [];
    var startQuaternions = [];
    for (var i = 0; i < movePieces.length; i++) {
        for (var j = 0; j < movePieces[i].meshes.length; j++) {
            var mesh = movePieces[i].meshes[j];
            allMeshes.push(mesh);
            startPositions.push(mesh.position.clone());
            startQuaternions.push(mesh.quaternion.clone());
        }
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

        for (var i = 0; i < allMeshes.length; i++) {
            allMeshes[i].position.copy(startPositions[i]).applyQuaternion(rotQuat);
            allMeshes[i].quaternion.copy(startQuaternions[i]).premultiply(rotQuat);
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

    function findByCorner(id) {
        for (var j = 0; j < skewbState.pieces.length; j++) {
            if (skewbState.pieces[j].cornerId === id) return skewbState.pieces[j];
        }
        return null;
    }
    function findByCenter(id) {
        for (var j = 0; j < skewbState.pieces.length; j++) {
            if (skewbState.pieces[j].centerId === id) return skewbState.pieces[j];
        }
        return null;
    }

    var cp = [findByCorner(cycleCornerIds[0]), findByCorner(cycleCornerIds[1]), findByCorner(cycleCornerIds[2])];
    var cep = [findByCenter(cycleCenterIds[0]), findByCenter(cycleCenterIds[1]), findByCenter(cycleCenterIds[2])];

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
