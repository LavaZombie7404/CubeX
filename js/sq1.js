// ==================== Square-1 (SQ-1) Puzzle ====================

var sq1State = {
    group: null,
    pieces: [],        // { type:'corner'|'edge', id, mesh, angle, span, layer:'top'|'bottom' }
    middleMeshes: [],  // [leftHalf, rightHalf]
    isAnimating: false,
    animationQueue: []
};

var SQ1_S = 0.6;   // half-side-length of the square cross-section
var SQ1_H = 0.35;
var SQ1_MID_H = 0.06;

var SQ1_COLORS = {
    top: 0xffffff,      // white
    bottom: 0xffff00,   // yellow
    dark: 0x111111,
    right: 0x0000ff,    // blue  (0 deg, +X)
    front: 0xff0000,    // red   (90 deg, +Z)
    left: 0x00ff00,     // green (180 deg)
    back: 0xffa500      // orange (270 deg)
};

// The axis-aligned square has flat faces at x=±S, z=±S.
// Corners of the square are at 45°, 135°, 225°, 315°.
// Each 90° color-sector (0-90 = right, 90-180 = front, etc.) spans
// two half-faces of the square meeting at a corner.

// Returns {x, z} on the square perimeter for a ray from origin at angleDeg.
function sq1SquarePoint(angleDeg, halfSize) {
    var rad = angleDeg * Math.PI / 180;
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    var m = Math.max(Math.abs(c), Math.abs(s));
    return { x: (halfSize / m) * c, z: (halfSize / m) * s };
}

// Generate square-perimeter points from startDeg to endDeg, inserting
// corner vertices at every 45°+n*90° boundary (the geometric corners
// of the square at 45°, 135°, 225°, 315°).
// Returns array of {x,z} with an .angles property tracking degree values.
function sq1SquareArcPoints(startDeg, endDeg, halfSize) {
    var points = [];
    var corners = [];
    // Square corners at 45, 135, 225, 315, 405, 495, ...
    var first = Math.ceil((startDeg + 0.001 - 45) / 90) * 90 + 45;
    for (var c = first; c < endDeg - 0.001; c += 90) {
        corners.push(c);
    }
    var angles = [startDeg];
    for (var i = 0; i < corners.length; i++) {
        angles.push(corners[i]);
    }
    angles.push(endDeg);
    for (var i = 0; i < angles.length; i++) {
        points.push(sq1SquarePoint(angles[i], halfSize));
    }
    points.angles = angles;
    return points;
}

function getSQ1SideColor(angleDeg) {
    var a = ((angleDeg % 360) + 360) % 360;
    if (a < 90) return SQ1_COLORS.right;
    if (a < 180) return SQ1_COLORS.front;
    if (a < 270) return SQ1_COLORS.left;
    return SQ1_COLORS.back;
}

function getSQ1PieceSideColors(angleDeg, spanDeg) {
    if (spanDeg === 60) {
        return [getSQ1SideColor(angleDeg + 15), getSQ1SideColor(angleDeg + 45)];
    } else {
        return [getSQ1SideColor(angleDeg + 15)];
    }
}

function getSolvedLayout() {
    var top = [];
    var bottom = [];
    var angle = 0;
    for (var i = 0; i < 4; i++) {
        top.push({ type: 'corner', angle: angle, span: 60 });
        angle += 60;
        top.push({ type: 'edge', angle: angle, span: 30 });
        angle += 30;
    }
    angle = 0;
    for (var i = 0; i < 4; i++) {
        bottom.push({ type: 'edge', angle: angle, span: 30 });
        angle += 30;
        bottom.push({ type: 'corner', angle: angle, span: 60 });
        angle += 60;
    }
    return { top: top, bottom: bottom };
}

// Build a piece mesh with geometry in WORLD coordinates.
// startDeg = the actual angle of the piece in the puzzle.
function createSQ1Piece(startDeg, spanDeg, isTop, sideColors) {
    var geometry = new THREE.BufferGeometry();
    var H = SQ1_H;
    var endDeg = startDeg + spanDeg;

    var vertices = [];
    var groups = [];

    var arcPoints = sq1SquareArcPoints(startDeg, endDeg, SQ1_S);
    var segs = arcPoints.length - 1;

    var yTop = isTop ? H : -SQ1_MID_H;
    var yBot = isTop ? SQ1_MID_H : -H;
    var triStart = 0;

    // --- Top cap ---
    for (var i = 0; i < segs; i++) {
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
        vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
    }
    groups.push({ start: triStart, count: segs * 3, materialIndex: 0 });
    triStart += segs * 3;

    // --- Bottom cap ---
    for (var i = 0; i < segs; i++) {
        vertices.push(0, yBot, 0);
        vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
    }
    groups.push({ start: triStart, count: segs * 3, materialIndex: 1 });
    triStart += segs * 3;

    // --- Outer wall ---
    if (spanDeg === 60 && sideColors.length === 2) {
        // Corner piece: split wall at the color boundary (startDeg + 30°).
        // Need to insert the 30° midpoint into the wall point list.
        var midAngle = startDeg + 30;
        var midPt = sq1SquarePoint(midAngle, SQ1_S);
        var wallPts = [];
        var splitIdx = -1;
        var ptAngles = arcPoints.angles;
        for (var i = 0; i <= segs; i++) {
            if (splitIdx < 0 && i > 0 && ptAngles[i] >= midAngle - 0.01) {
                if (Math.abs(ptAngles[i] - midAngle) > 0.01) {
                    // midAngle falls between previous and current; insert midPt
                    wallPts.push(midPt);
                    splitIdx = wallPts.length - 1; // index of midPt
                } else {
                    // arcPoints[i] IS the midpoint; it will be pushed below
                    splitIdx = wallPts.length;
                }
            }
            wallPts.push(arcPoints[i]);
        }
        if (splitIdx < 0) splitIdx = wallPts.length - 1;
        var wallSegs = wallPts.length - 1;

        // First side color
        var wallStart1 = triStart;
        var count1 = 0;
        for (var i = 0; i < splitIdx; i++) {
            vertices.push(wallPts[i].x, yTop, wallPts[i].z);
            vertices.push(wallPts[i + 1].x, yTop, wallPts[i + 1].z);
            vertices.push(wallPts[i + 1].x, yBot, wallPts[i + 1].z);
            vertices.push(wallPts[i].x, yTop, wallPts[i].z);
            vertices.push(wallPts[i + 1].x, yBot, wallPts[i + 1].z);
            vertices.push(wallPts[i].x, yBot, wallPts[i].z);
            count1 += 6;
        }
        groups.push({ start: wallStart1, count: count1, materialIndex: 2 });
        triStart += count1;

        // Second side color
        var wallStart2 = triStart;
        var count2 = 0;
        for (var i = splitIdx; i < wallSegs; i++) {
            vertices.push(wallPts[i].x, yTop, wallPts[i].z);
            vertices.push(wallPts[i + 1].x, yTop, wallPts[i + 1].z);
            vertices.push(wallPts[i + 1].x, yBot, wallPts[i + 1].z);
            vertices.push(wallPts[i].x, yTop, wallPts[i].z);
            vertices.push(wallPts[i + 1].x, yBot, wallPts[i + 1].z);
            vertices.push(wallPts[i].x, yBot, wallPts[i].z);
            count2 += 6;
        }
        groups.push({ start: wallStart2, count: count2, materialIndex: 3 });
        triStart += count2;
    } else {
        // Edge piece: single side color
        var wallStart = triStart;
        for (var i = 0; i < segs; i++) {
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);

            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        }
        groups.push({ start: wallStart, count: segs * 6, materialIndex: 2 });
        triStart += segs * 6;
    }

    // --- Radial wall at start angle ---
    var rw1Start = triStart;
    vertices.push(0, yTop, 0);
    vertices.push(arcPoints[0].x, yTop, arcPoints[0].z);
    vertices.push(arcPoints[0].x, yBot, arcPoints[0].z);
    vertices.push(0, yTop, 0);
    vertices.push(arcPoints[0].x, yBot, arcPoints[0].z);
    vertices.push(0, yBot, 0);
    var radialMat = spanDeg === 60 && sideColors.length === 2 ? 4 : 3;
    groups.push({ start: rw1Start, count: 6, materialIndex: radialMat });
    triStart += 6;

    // --- Radial wall at end angle ---
    var rw2Start = triStart;
    var last = arcPoints[segs];
    vertices.push(0, yTop, 0);
    vertices.push(last.x, yBot, last.z);
    vertices.push(last.x, yTop, last.z);
    vertices.push(0, yTop, 0);
    vertices.push(0, yBot, 0);
    vertices.push(last.x, yBot, last.z);
    groups.push({ start: rw2Start, count: 6, materialIndex: radialMat + 1 });
    triStart += 6;

    var posArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.computeVertexNormals();

    geometry.clearGroups();
    for (var g = 0; g < groups.length; g++) {
        geometry.addGroup(groups[g].start, groups[g].count, groups[g].materialIndex);
    }

    var materials = [];
    var layerColor = isTop ? SQ1_COLORS.top : SQ1_COLORS.bottom;

    if (isTop) {
        materials.push(new THREE.MeshLambertMaterial({ color: layerColor }));       // 0: top cap
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 1: bottom cap
    } else {
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 0: top cap (inner)
        materials.push(new THREE.MeshLambertMaterial({ color: layerColor }));       // 1: bottom cap
    }

    if (spanDeg === 60 && sideColors.length === 2) {
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[0] }));    // 2: side 1
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[1] }));    // 3: side 2
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 4: radial
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 5: radial
    } else {
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[0] }));    // 2: side
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 3: radial
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));  // 4: radial
    }

    var mesh = new THREE.Mesh(geometry, materials);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 20);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

function createSQ1Middle() {
    var yTop = SQ1_MID_H;
    var yBot = -SQ1_MID_H;
    var meshes = [];

    var halves = [
        { startDeg: 180, endDeg: 360, color: SQ1_COLORS.dark },
        { startDeg: 0, endDeg: 180, color: 0x333333 }
    ];

    for (var h = 0; h < 2; h++) {
        var half = halves[h];
        var geometry = new THREE.BufferGeometry();
        var vertices = [];

        var arcPoints = sq1SquareArcPoints(half.startDeg, half.endDeg, SQ1_S);
        var segs = arcPoints.length - 1;

        // Top cap
        for (var i = 0; i < segs; i++) {
            vertices.push(0, yTop, 0);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
        }
        // Bottom cap
        for (var i = 0; i < segs; i++) {
            vertices.push(0, yBot, 0);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
        }
        // Outer wall
        for (var i = 0; i < segs; i++) {
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);

            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        }
        // Flat face at end
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[segs].x, yTop, arcPoints[segs].z);
        vertices.push(arcPoints[segs].x, yBot, arcPoints[segs].z);
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[segs].x, yBot, arcPoints[segs].z);
        vertices.push(0, yBot, 0);
        // Flat face at start
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[0].x, yBot, arcPoints[0].z);
        vertices.push(arcPoints[0].x, yTop, arcPoints[0].z);
        vertices.push(0, yTop, 0);
        vertices.push(0, yBot, 0);
        vertices.push(arcPoints[0].x, yBot, arcPoints[0].z);

        var posArray = new Float32Array(vertices);
        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.computeVertexNormals();

        var material = new THREE.MeshLambertMaterial({ color: half.color, side: THREE.DoubleSide });
        var mesh = new THREE.Mesh(geometry, material);

        var edgesGeo = new THREE.EdgesGeometry(geometry, 20);
        var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

        meshes.push(mesh);
    }

    return meshes;
}

// Rebuild piece mesh at its current angle with correct square geometry.
function rebuildSQ1Piece(piece) {
    var oldMesh = piece.mesh;
    var oldMats = oldMesh.material;
    var sideColors = [];
    if (piece.span === 60) {
        sideColors = [oldMats[2].color.getHex(), oldMats[3].color.getHex()];
    } else {
        sideColors = [oldMats[2].color.getHex()];
    }
    var newMesh = createSQ1Piece(piece.angle, piece.span, piece.layer === 'top', sideColors);
    if (oldMesh.parent) {
        oldMesh.parent.add(newMesh);
        oldMesh.parent.remove(oldMesh);
    }
    piece.mesh = newMesh;
}

function positionSQ1Piece(piece) {
    piece.mesh.position.set(0, 0, 0);
    piece.mesh.rotation.set(0, 0, 0);
    piece.mesh.quaternion.set(0, 0, 0, 1);
}

function createSquareOne() {
    sq1State.group = new THREE.Group();
    sq1State.pieces = [];
    sq1State.middleMeshes = [];
    sq1State.isAnimating = false;
    sq1State.animationQueue = [];

    var layout = getSolvedLayout();
    var idCounter = 0;

    for (var i = 0; i < layout.top.length; i++) {
        var def = layout.top[i];
        var sideColors = getSQ1PieceSideColors(def.angle, def.span);
        var mesh = createSQ1Piece(def.angle, def.span, true, sideColors);
        var piece = {
            type: def.type, id: idCounter++, mesh: mesh,
            angle: def.angle, span: def.span, layer: 'top'
        };
        sq1State.pieces.push(piece);
        sq1State.group.add(mesh);
    }

    for (var i = 0; i < layout.bottom.length; i++) {
        var def = layout.bottom[i];
        var sideColors = getSQ1PieceSideColors(def.angle, def.span);
        var mesh = createSQ1Piece(def.angle, def.span, false, sideColors);
        var piece = {
            type: def.type, id: idCounter++, mesh: mesh,
            angle: def.angle, span: def.span, layer: 'bottom'
        };
        sq1State.pieces.push(piece);
        sq1State.group.add(mesh);
    }

    var middleMeshes = createSQ1Middle();
    sq1State.middleMeshes = middleMeshes;
    for (var i = 0; i < middleMeshes.length; i++) {
        sq1State.group.add(middleMeshes[i]);
    }

    return sq1State.group;
}

function normAngle(a) {
    return ((a % 360) + 360) % 360;
}

function pieceStraddlesCut(piece, cutAngle) {
    var start = normAngle(piece.angle);
    var end = normAngle(piece.angle + piece.span);
    var cut = normAngle(cutAngle);

    if (start < end) {
        return cut > start && cut < end;
    } else {
        return cut > start || cut < end;
    }
}

function canSliceSQ1() {
    for (var i = 0; i < sq1State.pieces.length; i++) {
        var p = sq1State.pieces[i];
        if (pieceStraddlesCut(p, 0) || pieceStraddlesCut(p, 180)) {
            return false;
        }
    }
    return true;
}

function getRightHalfPieces(layer) {
    var result = [];
    for (var i = 0; i < sq1State.pieces.length; i++) {
        var p = sq1State.pieces[i];
        if (p.layer !== layer) continue;
        var start = normAngle(p.angle);
        if (start >= 0 && start < 180 && (start + p.span) <= 180) {
            result.push(p);
        }
    }
    return result;
}

function rotateSQ1Layer(layer, amount, onComplete) {
    if (sq1State.isAnimating) {
        sq1State.animationQueue.push({ type: 'rotate', layer: layer, amount: amount, onComplete: onComplete });
        return;
    }

    if (amount === 0) {
        if (onComplete) onComplete();
        return;
    }

    sq1State.isAnimating = true;

    if (!isSolving) {
        moveHistory.push({ type: 'sq1', move: layer, amount: amount });
    }

    var angleDelta = amount * 30;
    var targetAngleRad = angleDelta * Math.PI / 180;
    var duration = Math.min(Math.abs(amount) * 80, 400);

    var layerPieces = [];
    for (var i = 0; i < sq1State.pieces.length; i++) {
        if (sq1State.pieces[i].layer === layer) {
            layerPieces.push(sq1State.pieces[i]);
        }
    }

    var startRotations = layerPieces.map(function(p) { return p.mesh.rotation.y; });
    var startTime = performance.now();

    function animate() {
        var elapsed = performance.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        var currentAngle = -targetAngleRad * eased;

        for (var i = 0; i < layerPieces.length; i++) {
            layerPieces[i].mesh.rotation.y = startRotations[i] + currentAngle;
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            for (var i = 0; i < layerPieces.length; i++) {
                layerPieces[i].angle = normAngle(layerPieces[i].angle + angleDelta);
            }
            // Rebuild meshes with correct square geometry at new angle
            for (var i = 0; i < layerPieces.length; i++) {
                rebuildSQ1Piece(layerPieces[i]);
            }

            sq1State.isAnimating = false;
            if (onComplete) onComplete();
            processNextSQ1Animation();
        }
    }

    animate();
}

function sliceSQ1(onComplete) {
    if (sq1State.isAnimating) {
        sq1State.animationQueue.push({ type: 'slice', onComplete: onComplete });
        return;
    }

    if (!canSliceSQ1()) {
        if (onComplete) onComplete();
        return;
    }

    sq1State.isAnimating = true;

    if (!isSolving) {
        moveHistory.push({ type: 'sq1', move: 'slice', amount: 0 });
    }

    var topRight = getRightHalfPieces('top');
    var bottomRight = getRightHalfPieces('bottom');
    var rightPieces = topRight.concat(bottomRight);

    var duration = 350;
    var startTime = performance.now();

    var startQuats = rightPieces.map(function(p) { return p.mesh.quaternion.clone(); });
    var startPositions = rightPieces.map(function(p) { return p.mesh.position.clone(); });

    var sliceAxis = new THREE.Vector3(0, 0, 1);

    function animate() {
        var elapsed = performance.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        var currentAngle = Math.PI * eased;
        var rotQuat = new THREE.Quaternion();
        rotQuat.setFromAxisAngle(sliceAxis, currentAngle);

        for (var i = 0; i < rightPieces.length; i++) {
            rightPieces[i].mesh.position.copy(startPositions[i]);
            rightPieces[i].mesh.quaternion.copy(startQuats[i]);
            rightPieces[i].mesh.position.applyQuaternion(rotQuat);
            rightPieces[i].mesh.quaternion.premultiply(rotQuat);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            for (var i = 0; i < rightPieces.length; i++) {
                var p = rightPieces[i];
                var newAngle = normAngle(180 - p.angle - p.span);
                p.angle = newAngle;
                p.layer = p.layer === 'top' ? 'bottom' : 'top';
            }

            // Recreate meshes with correct geometry and colors.
            // After 180° flip around Z, the piece is reversed:
            // what was the first side (lower angle) is now the second side.
            // So we must REVERSE the side colors for corner pieces.
            for (var i = 0; i < rightPieces.length; i++) {
                var p = rightPieces[i];
                sq1State.group.remove(p.mesh);
                var sideColors = [];
                var oldMats = p.mesh.material;
                if (p.span === 60) {
                    // Reverse: the slice flips the piece so side order swaps
                    sideColors = [oldMats[3].color.getHex(), oldMats[2].color.getHex()];
                } else {
                    sideColors = [oldMats[2].color.getHex()];
                }
                var newMesh = createSQ1Piece(p.angle, p.span, p.layer === 'top', sideColors);
                p.mesh = newMesh;
                sq1State.group.add(newMesh);
            }

            sq1State.isAnimating = false;
            if (onComplete) onComplete();
            processNextSQ1Animation();
        }
    }

    animate();
}

function processNextSQ1Animation() {
    if (sq1State.animationQueue.length > 0) {
        var next = sq1State.animationQueue.shift();
        if (next.type === 'slice') {
            sliceSQ1(next.onComplete);
        } else {
            rotateSQ1Layer(next.layer, next.amount, next.onComplete);
        }
    }
}

function scrambleSQ1(moveCount, onComplete) {
    moveCount = moveCount || 20;
    var moves = [];

    for (var i = 0; i < moveCount; i++) {
        if (i % 3 === 2) {
            moves.push({ type: 'slice' });
        } else {
            var layer = Math.random() < 0.5 ? 'top' : 'bottom';
            var amount = Math.floor(Math.random() * 11) - 5;
            if (amount === 0) amount = 1;
            moves.push({ type: 'rotate', layer: layer, amount: amount });
        }
    }

    var index = 0;
    function executeNext() {
        if (index >= moves.length) {
            if (onComplete) onComplete();
            return;
        }
        var move = moves[index++];
        if (move.type === 'slice') {
            if (canSliceSQ1()) {
                sliceSQ1(executeNext);
            } else {
                executeNext();
            }
        } else {
            rotateSQ1Layer(move.layer, move.amount, executeNext);
        }
    }

    executeNext();
}

function setupSQ1Controls() {
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        if (typeof currentPuzzle === 'undefined' || currentPuzzle !== 'sq1') return;
        if (sq1State.isAnimating) return;

        var key = e.key;
        var shift = e.shiftKey;

        switch (key.toLowerCase()) {
            case 'u':
                e.preventDefault();
                rotateSQ1Layer('top', shift ? -1 : 1);
                break;
            case 'd':
                e.preventDefault();
                rotateSQ1Layer('bottom', shift ? -1 : 1);
                break;
            case '/':
                e.preventDefault();
                if (canSliceSQ1()) {
                    sliceSQ1();
                }
                break;
        }
    });
}
