// ==================== Skewb Puzzle ====================

var skewbState = {
    group: null,
    pieces: [],        // { type:'corner'|'center', id, refPos:[x,y,z], meshes:[] }
    body: null,
    isAnimating: false,
    animationQueue: []
};

var SKEWB_S = 0.6;
var SKEWB_GAP = 0.015;
var SKEWB_RAISE = 0.01;

var SKEWB_COLORS = {
    U: 0xffffff,
    D: 0xffff00,
    F: 0xff0000,
    B: 0xffa500,
    L: 0x00ff00,
    R: 0x0000ff,
    dark: 0x222222
};

// Move definitions: axis points from pivot corner toward opposite corner.
// The half containing the pivot (dot < 0) rotates by 120°.
var SKEWB_MOVES = {
    R: { axis: [-1, 1,-1] },   // FRD → BLU diagonal
    L: { axis: [ 1, 1,-1] },   // FLD → BRU diagonal
    U: { axis: [ 1,-1, 1] },   // BLU → FRD diagonal
    B: { axis: [-1, 1, 1] }    // BRD → FLU diagonal
};

// Corner definitions
var SKEWB_CORNER_DEFS = [
    { sx: 1, sy: 1, sz: 1 },
    { sx:-1, sy: 1, sz: 1 },
    { sx: 1, sy: 1, sz:-1 },
    { sx:-1, sy: 1, sz:-1 },
    { sx: 1, sy:-1, sz: 1 },
    { sx:-1, sy:-1, sz: 1 },
    { sx: 1, sy:-1, sz:-1 },
    { sx:-1, sy:-1, sz:-1 }
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

// Create a flat colored sticker mesh from coplanar polygon points.
function createStickerMesh(points, color, nx, ny, nz) {
    var geometry = new THREE.BufferGeometry();
    var vertices = [];

    for (var i = 1; i < points.length - 1; i++) {
        var a = points[0], b = points[i], c = points[i + 1];
        var abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
        var acx = c[0]-a[0], acy = c[1]-a[1], acz = c[2]-a[2];
        var crx = aby*acz - abz*acy;
        var cry = abz*acx - abx*acz;
        var crz = abx*acy - aby*acx;
        var dot = crx*nx + cry*ny + crz*nz;
        if (dot >= 0) {
            vertices.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
        } else {
            vertices.push(a[0],a[1],a[2], c[0],c[1],c[2], b[0],b[1],b[2]);
        }
    }

    var posArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.computeVertexNormals();

    var material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geometry, material);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 10);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

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

function getFaceColor(nx, ny, nz) {
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
    var T = S / 3;

    // Dark body cube
    var bodyGeom = new THREE.BoxGeometry(2 * S * 0.95, 2 * S * 0.95, 2 * S * 0.95);
    var bodyMat = new THREE.MeshLambertMaterial({ color: SKEWB_COLORS.dark, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    skewbState.body = new THREE.Mesh(bodyGeom, bodyMat);
    skewbState.group.add(skewbState.body);

    var idCounter = 0;

    // ---- Create 8 corner pieces ----
    // Each corner has 3 colored face stickers + 1 dark internal face.
    // All share the cube corner vertex so tips are fully colored.
    for (var ci = 0; ci < SKEWB_CORNER_DEFS.length; ci++) {
        var cd = SKEWB_CORNER_DEFS[ci];
        var meshes = [];

        var cx = cd.sx * S, cy = cd.sy * S, cz = cd.sz * S;
        var vx = [cx - cd.sx * 2 * T, cy, cz];
        var vy = [cx, cy - cd.sy * 2 * T, cz];
        var vz = [cx, cy, cz - cd.sz * 2 * T];
        var v0 = [cx, cy, cz];

        // Y-normal face (U/D): v0, vx, vz — all at y = cy
        var yColor = SKEWB_COLORS[getFaceColor(0, cd.sy, 0)];
        var yPts = raisePolygon(shrinkPolygon([v0, vx, vz], SKEWB_GAP), 0, cd.sy, 0, SKEWB_RAISE);
        meshes.push(createStickerMesh(yPts, yColor, 0, cd.sy, 0));

        // Z-normal face (F/B): v0, vx, vy — all at z = cz
        var zColor = SKEWB_COLORS[getFaceColor(0, 0, cd.sz)];
        var zPts = raisePolygon(shrinkPolygon([v0, vx, vy], SKEWB_GAP), 0, 0, cd.sz, SKEWB_RAISE);
        meshes.push(createStickerMesh(zPts, zColor, 0, 0, cd.sz));

        // X-normal face (R/L): v0, vy, vz — all at x = cx
        var xColor = SKEWB_COLORS[getFaceColor(cd.sx, 0, 0)];
        var xPts = raisePolygon(shrinkPolygon([v0, vy, vz], SKEWB_GAP), cd.sx, 0, 0, SKEWB_RAISE);
        meshes.push(createStickerMesh(xPts, xColor, cd.sx, 0, 0));

        console.log('Corner', ci, 'colors: Y=0x'+yColor.toString(16), 'Z=0x'+zColor.toString(16), 'X=0x'+xColor.toString(16));

        // Internal cut face: vx, vy, vz
        meshes.push(createStickerMesh([vx, vy, vz], SKEWB_COLORS.dark, -cd.sx, -cd.sy, -cd.sz));

        for (var m = 0; m < meshes.length; m++) {
            skewbState.group.add(meshes[m]);
        }

        skewbState.pieces.push({
            type: 'corner', id: idCounter++,
            refPos: [cx, cy, cz],
            meshes: meshes
        });
    }

    // ---- Create 6 center pieces ----
    for (var fi = 0; fi < SKEWB_CENTER_DEFS.length; fi++) {
        var fd = SKEWB_CENTER_DEFS[fi];
        var nx = fd.nx, ny = fd.ny, nz = fd.nz;

        var octPts;
        if (fd.id === 'U') {
            octPts = [[T,S,S],[S,S,T],[S,S,-T],[T,S,-S],[-T,S,-S],[-S,S,-T],[-S,S,T],[-T,S,S]];
        } else if (fd.id === 'D') {
            octPts = [[T,-S,S],[S,-S,T],[S,-S,-T],[T,-S,-S],[-T,-S,-S],[-S,-S,-T],[-S,-S,T],[-T,-S,S]];
        } else if (fd.id === 'F') {
            octPts = [[T,S,S],[S,T,S],[S,-T,S],[T,-S,S],[-T,-S,S],[-S,-T,S],[-S,T,S],[-T,S,S]];
        } else if (fd.id === 'B') {
            octPts = [[-T,S,-S],[-S,T,-S],[-S,-T,-S],[-T,-S,-S],[T,-S,-S],[S,-T,-S],[S,T,-S],[T,S,-S]];
        } else if (fd.id === 'R') {
            octPts = [[S,T,S],[S,S,T],[S,S,-T],[S,T,-S],[S,-T,-S],[S,-S,-T],[S,-S,T],[S,-T,S]];
        } else {
            octPts = [[-S,T,S],[-S,S,T],[-S,S,-T],[-S,T,-S],[-S,-T,-S],[-S,-S,-T],[-S,-S,T],[-S,-T,S]];
        }

        octPts = shrinkPolygon(octPts, SKEWB_GAP);
        octPts = raisePolygon(octPts, nx, ny, nz, SKEWB_RAISE);

        var mesh = createStickerMesh(octPts, SKEWB_COLORS[fd.id], nx, ny, nz);
        skewbState.group.add(mesh);

        skewbState.pieces.push({
            type: 'center', id: idCounter++,
            refPos: [nx * S, ny * S, nz * S],
            meshes: [mesh]
        });
    }

    return skewbState.group;
}

// Determine which pieces are on the moving half for a given move.
// Uses physical position: transform piece's reference position through its
// accumulated quaternion rotation, then check which side of the cut plane it's on.
function getMovePieces(moveName) {
    var moveDef = SKEWB_MOVES[moveName];
    var axis = new THREE.Vector3(moveDef.axis[0], moveDef.axis[1], moveDef.axis[2]).normalize();
    var pieces = [];

    for (var i = 0; i < skewbState.pieces.length; i++) {
        var p = skewbState.pieces[i];
        var ref = new THREE.Vector3(p.refPos[0], p.refPos[1], p.refPos[2]);

        // Transform reference position through accumulated mesh rotation
        var currentPos = ref.clone().applyQuaternion(p.meshes[0].quaternion);

        // Piece is on the moving half if dot product with axis is negative
        if (currentPos.dot(axis) < -0.01) {
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

    // Collect all meshes
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
            skewbState.isAnimating = false;
            if (onComplete) onComplete();
            processNextSkewbAnimation();
        }
    }

    animate();
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
