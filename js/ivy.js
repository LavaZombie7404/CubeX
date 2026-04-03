// ==================== Ivy Cube Puzzle ====================

var ivyState = {
    group: null,
    pieces: [],    // { type:'corner'|'center', refPos:[x,y,z], meshes:[] }
    body: null,
    isAnimating: false,
    animationQueue: []
};

var IVY_S = 0.6;
var IVY_GAP = 0.015;
var IVY_RAISE = 0.01;

var IVY_COLORS = {
    top: 0xffffff,
    bottom: 0xffff00,
    right: 0xff0000,
    left: 0xffa500,
    front: 0x00ff00,
    back: 0x0000ff,
    dark: 0x222222
};

// 4 movable corners (tetrahedron inscribed in cube).
// Each move rotates the corner's 3 petals + the 3 adjacent face centers.
// Axis points toward the pivot corner; pieces with dot > 0 move.
var IVY_MOVES = {
    F: { axis: [ 1, 1, 1] },
    L: { axis: [ 1,-1,-1] },
    B: { axis: [-1, 1,-1] },
    R: { axis: [-1,-1, 1] }
};

function ivyStickerMesh(points, color, nx, ny, nz) {
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
    var material = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geometry, material);
    var edgesGeo = new THREE.EdgesGeometry(geometry, 10);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));
    return mesh;
}

function ivyShrink(points, gap) {
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

function ivyRaise(points, nx, ny, nz, amount) {
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

function createIvy() {
    ivyState.group = new THREE.Group();
    ivyState.pieces = [];
    ivyState.isAnimating = false;
    ivyState.animationQueue = [];

    var S = IVY_S;

    // Dark body cube
    var bodyGeom = new THREE.BoxGeometry(2 * S * 0.95, 2 * S * 0.95, 2 * S * 0.95);
    var bodyMat = new THREE.MeshLambertMaterial({ color: IVY_COLORS.dark, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    ivyState.body = new THREE.Mesh(bodyGeom, bodyMat);
    ivyState.group.add(ivyState.body);

    // Movable corners (tetrahedron A): 0=(S,S,S), 1=(-S,S,-S), 2=(S,-S,-S), 3=(-S,-S,S)
    // Fixed corners (tetrahedron B): (-S,S,S), (S,S,-S), (-S,-S,-S), (S,-S,S)
    // Each face has a hexagonal center + 2 triangular petals at the movable corners.

    // Face normals, colors, center hex vertices, and petal definitions
    var faceDefs = [
        { nx: 0, ny: 1, nz: 0, color: IVY_COLORS.top,
          center: [[0,S,S], [-S,S,S], [-S,S,0], [0,S,-S], [S,S,-S], [S,S,0]],
          petals: [
              { corner: 0, pts: [[S,S,S], [0,S,S], [S,S,0]] },
              { corner: 1, pts: [[-S,S,-S], [-S,S,0], [0,S,-S]] }
          ]},
        { nx: 0, ny:-1, nz: 0, color: IVY_COLORS.bottom,
          center: [[0,-S,S], [S,-S,S], [S,-S,0], [0,-S,-S], [-S,-S,-S], [-S,-S,0]],
          petals: [
              { corner: 2, pts: [[S,-S,-S], [S,-S,0], [0,-S,-S]] },
              { corner: 3, pts: [[-S,-S,S], [0,-S,S], [-S,-S,0]] }
          ]},
        { nx: 1, ny: 0, nz: 0, color: IVY_COLORS.right,
          center: [[S,0,S], [S,-S,S], [S,-S,0], [S,0,-S], [S,S,-S], [S,S,0]],
          petals: [
              { corner: 0, pts: [[S,S,S], [S,S,0], [S,0,S]] },
              { corner: 2, pts: [[S,-S,-S], [S,0,-S], [S,-S,0]] }
          ]},
        { nx:-1, ny: 0, nz: 0, color: IVY_COLORS.left,
          center: [[-S,0,S], [-S,S,S], [-S,S,0], [-S,0,-S], [-S,-S,-S], [-S,-S,0]],
          petals: [
              { corner: 1, pts: [[-S,S,-S], [-S,0,-S], [-S,S,0]] },
              { corner: 3, pts: [[-S,-S,S], [-S,-S,0], [-S,0,S]] }
          ]},
        { nx: 0, ny: 0, nz: 1, color: IVY_COLORS.front,
          center: [[0,S,S], [-S,S,S], [-S,0,S], [0,-S,S], [S,-S,S], [S,0,S]],
          petals: [
              { corner: 0, pts: [[S,S,S], [0,S,S], [S,0,S]] },
              { corner: 3, pts: [[-S,-S,S], [-S,0,S], [0,-S,S]] }
          ]},
        { nx: 0, ny: 0, nz:-1, color: IVY_COLORS.back,
          center: [[0,S,-S], [S,S,-S], [S,0,-S], [0,-S,-S], [-S,-S,-S], [-S,0,-S]],
          petals: [
              { corner: 1, pts: [[-S,S,-S], [-S,0,-S], [0,S,-S]] },
              { corner: 2, pts: [[S,-S,-S], [0,-S,-S], [S,0,-S]] }
          ]}
    ];

    // Collect petal meshes per corner (0-3)
    var cornerMeshes = [[], [], [], []];
    var cornerRefPos = [
        [S, S, S], [-S, S, -S], [S, -S, -S], [-S, -S, S]
    ];

    for (var fi = 0; fi < faceDefs.length; fi++) {
        var f = faceDefs[fi];

        // Center hexagon — refPos at face center (on cube surface)
        var cPts = ivyShrink(f.center, IVY_GAP);
        cPts = ivyRaise(cPts, f.nx, f.ny, f.nz, IVY_RAISE);
        var centerMesh = ivyStickerMesh(cPts, f.color, f.nx, f.ny, f.nz);
        ivyState.group.add(centerMesh);
        ivyState.pieces.push({
            type: 'center',
            refPos: [f.nx * S, f.ny * S, f.nz * S],
            meshes: [centerMesh]
        });

        // Petal triangles
        for (var pi = 0; pi < f.petals.length; pi++) {
            var petal = f.petals[pi];
            var pPts = ivyShrink(petal.pts, IVY_GAP);
            pPts = ivyRaise(pPts, f.nx, f.ny, f.nz, IVY_RAISE);
            var petalMesh = ivyStickerMesh(pPts, f.color, f.nx, f.ny, f.nz);
            ivyState.group.add(petalMesh);
            cornerMeshes[petal.corner].push(petalMesh);
        }
    }

    // Create corner pieces (each has 3 petal meshes)
    for (var c = 0; c < 4; c++) {
        ivyState.pieces.push({
            type: 'corner',
            refPos: cornerRefPos[c],
            meshes: cornerMeshes[c]
        });
    }

    return ivyState.group;
}

// Find pieces on the moving side of a turn using dot product.
// Pieces whose current position has dot > 0 with the axis move.
function ivyGetMovePieces(moveName) {
    var moveDef = IVY_MOVES[moveName];
    var axis = new THREE.Vector3(moveDef.axis[0], moveDef.axis[1], moveDef.axis[2]).normalize();
    var pieces = [];

    for (var i = 0; i < ivyState.pieces.length; i++) {
        var p = ivyState.pieces[i];
        var ref = new THREE.Vector3(p.refPos[0], p.refPos[1], p.refPos[2]);
        var currentPos = ref.clone().applyQuaternion(p.meshes[0].quaternion);
        if (currentPos.dot(axis) > 0.01) {
            pieces.push(p);
        }
    }

    return pieces;
}

function rotateIvyMove(moveName, clockwise, onComplete) {
    if (ivyState.isAnimating) {
        ivyState.animationQueue.push({ move: moveName, clockwise: clockwise, onComplete: onComplete });
        return;
    }

    ivyState.isAnimating = true;

    if (!isSolving) {
        moveHistory.push({ type: 'ivy', move: moveName, clockwise: clockwise });
    }

    var moveDef = IVY_MOVES[moveName];
    var axisVec = new THREE.Vector3(moveDef.axis[0], moveDef.axis[1], moveDef.axis[2]).normalize();
    var angle = clockwise ? -2 * Math.PI / 3 : 2 * Math.PI / 3;

    var movePieces = ivyGetMovePieces(moveName);

    // Collect all meshes from moving pieces
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
            ivyState.isAnimating = false;
            if (onComplete) onComplete();
            if (ivyState.animationQueue.length > 0) {
                var next = ivyState.animationQueue.shift();
                rotateIvyMove(next.move, next.clockwise, next.onComplete);
            }
        }
    }

    animate();
}

function scrambleIvy(moveCount, onComplete) {
    moveCount = moveCount || 10;
    var moveNames = ['R', 'L', 'B', 'F'];
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
        rotateIvyMove(m.move, m.clockwise, executeNext);
    }
    executeNext();
}

function setupIvyControls() {
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        if (typeof currentPuzzle === 'undefined' || currentPuzzle !== 'ivy') return;
        if (ivyState.isAnimating) return;

        var key = e.key.toLowerCase();
        var clockwise = !e.shiftKey;

        switch (key) {
            case 'r':
                e.preventDefault();
                rotateIvyMove('R', clockwise);
                break;
            case 'l':
                e.preventDefault();
                rotateIvyMove('L', clockwise);
                break;
            case 'f':
                e.preventDefault();
                rotateIvyMove('F', clockwise);
                break;
            case 'b':
                e.preventDefault();
                rotateIvyMove('B', clockwise);
                break;
        }
    });
}
