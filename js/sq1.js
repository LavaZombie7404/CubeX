// ==================== Square-1 (SQ-1) Puzzle ====================

var sq1State = {
    group: null,
    pieces: [],        // { type:'corner'|'edge', id, mesh, angle, span, layer:'top'|'bottom' }
    middleMeshes: [],  // [leftHalf, rightHalf]
    isAnimating: false,
    animationQueue: []
};

var SQ1_R = 0.8;
var SQ1_H = 0.35;
var SQ1_MID_H = 0.06;
var SQ1_ARC_SEGS = 8;

var SQ1_COLORS = {
    top: 0xffffff,      // white
    bottom: 0xffff00,   // yellow
    dark: 0x111111,
    right: 0x0000ff,    // blue  (0 deg, +X)
    front: 0xff0000,    // red   (90 deg, +Z)
    left: 0x00ff00,     // green (180 deg)
    back: 0xffa500      // orange (270 deg)
};

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

function createSQ1Piece(spanDeg, isTop, sideColors) {
    var geometry = new THREE.BufferGeometry();
    var R = SQ1_R;
    var H = SQ1_H;
    var segs = Math.round(SQ1_ARC_SEGS * spanDeg / 30);
    if (segs < 2) segs = 2;

    var vertices = [];
    var groups = [];

    var arcPoints = [];
    for (var i = 0; i <= segs; i++) {
        var t = (i / segs) * spanDeg * Math.PI / 180;
        arcPoints.push({ x: Math.cos(t) * R, z: Math.sin(t) * R });
    }

    var yTop = isTop ? H : -SQ1_MID_H;
    var yBot = isTop ? SQ1_MID_H : -H;
    var triStart = 0;

    // --- Top cap (normal +Y) ---
    for (var i = 0; i < segs; i++) {
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
        vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
    }
    groups.push({ start: triStart, count: segs * 3, materialIndex: 0 });
    triStart += segs * 3;

    // --- Bottom cap (normal -Y) ---
    for (var i = 0; i < segs; i++) {
        vertices.push(0, yBot, 0);
        vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
    }
    groups.push({ start: triStart, count: segs * 3, materialIndex: 1 });
    triStart += segs * 3;

    // --- Outer wall (normal outward) ---
    if (spanDeg === 60 && sideColors.length === 2) {
        var halfSegs = Math.round(segs / 2);
        var wallStart1 = triStart;
        for (var i = 0; i < halfSegs; i++) {
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);

            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        }
        groups.push({ start: wallStart1, count: halfSegs * 6, materialIndex: 2 });
        triStart += halfSegs * 6;

        var wallStart2 = triStart;
        for (var i = halfSegs; i < segs; i++) {
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);

            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        }
        groups.push({ start: wallStart2, count: (segs - halfSegs) * 6, materialIndex: 3 });
        triStart += (segs - halfSegs) * 6;
    } else {
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

    // --- Radial wall at angle 0 (normal faces -Z, away from piece interior) ---
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

    // --- Radial wall at spanDeg (normal faces away from piece interior) ---
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
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[0] }));
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[1] }));
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));
    } else {
        materials.push(new THREE.MeshLambertMaterial({ color: sideColors[0] }));
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));
        materials.push(new THREE.MeshLambertMaterial({ color: SQ1_COLORS.dark }));
    }

    var mesh = new THREE.Mesh(geometry, materials);

    var edgesGeo = new THREE.EdgesGeometry(geometry, 20);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return mesh;
}

function createSQ1Middle() {
    var R = SQ1_R;
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
        var segs = 16;
        var vertices = [];

        var arcPoints = [];
        for (var i = 0; i <= segs; i++) {
            var t = (half.startDeg + (i / segs) * (half.endDeg - half.startDeg)) * Math.PI / 180;
            arcPoints.push({ x: Math.cos(t) * R, z: Math.sin(t) * R });
        }

        // Top cap (normal +Y)
        for (var i = 0; i < segs; i++) {
            vertices.push(0, yTop, 0);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
        }
        // Bottom cap (normal -Y)
        for (var i = 0; i < segs; i++) {
            vertices.push(0, yBot, 0);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
        }
        // Outer wall (normal outward)
        for (var i = 0; i < segs; i++) {
            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yTop, arcPoints[i + 1].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);

            vertices.push(arcPoints[i].x, yTop, arcPoints[i].z);
            vertices.push(arcPoints[i + 1].x, yBot, arcPoints[i + 1].z);
            vertices.push(arcPoints[i].x, yBot, arcPoints[i].z);
        }
        // Flat face at end of arc
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[segs].x, yTop, arcPoints[segs].z);
        vertices.push(arcPoints[segs].x, yBot, arcPoints[segs].z);
        vertices.push(0, yTop, 0);
        vertices.push(arcPoints[segs].x, yBot, arcPoints[segs].z);
        vertices.push(0, yBot, 0);
        // Flat face at start of arc
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

function positionSQ1Piece(piece) {
    var angleRad = piece.angle * Math.PI / 180;

    piece.mesh.position.set(0, 0, 0);
    piece.mesh.rotation.set(0, 0, 0);
    piece.mesh.quaternion.set(0, 0, 0, 1);

    // Convention: angle 0 = +X, increases counterclockwise from above.
    // Three.js positive Y rotation = clockwise from above (right-hand rule).
    // So negative Y rotation = counterclockwise = our positive angle direction.
    piece.mesh.rotation.y = -angleRad;
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
        var mesh = createSQ1Piece(def.span, true, sideColors);
        var piece = {
            type: def.type, id: idCounter++, mesh: mesh,
            angle: def.angle, span: def.span, layer: 'top'
        };
        positionSQ1Piece(piece);
        sq1State.pieces.push(piece);
        sq1State.group.add(mesh);
    }

    for (var i = 0; i < layout.bottom.length; i++) {
        var def = layout.bottom[i];
        var sideColors = getSQ1PieceSideColors(def.angle, def.span);
        var mesh = createSQ1Piece(def.span, false, sideColors);
        var piece = {
            type: def.type, id: idCounter++, mesh: mesh,
            angle: def.angle, span: def.span, layer: 'bottom'
        };
        positionSQ1Piece(piece);
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
            for (var i = 0; i < layerPieces.length; i++) {
                positionSQ1Piece(layerPieces[i]);
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

    // The SQ-1 slice rotates the right half 180 degrees around the Z axis.
    // This flips top<->bottom (Y inverts) and mirrors the angular position
    // (X inverts), while Z stays the same. The result: angle theta maps to
    // (180 - theta) and layer swaps.
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
            // After 180 rotation around Z: (x,y,z) -> (-x,-y,z)
            // angle theta -> 180-theta, layer swaps top<->bottom
            // Piece at [theta, theta+s) -> [180-(theta+s), 180-theta)
            // New start angle = 180 - theta - s
            for (var i = 0; i < rightPieces.length; i++) {
                var p = rightPieces[i];
                var newAngle = normAngle(180 - p.angle - p.span);
                p.angle = newAngle;
                p.layer = p.layer === 'top' ? 'bottom' : 'top';
            }

            // Recreate meshes with correct layer cap colors
            for (var i = 0; i < rightPieces.length; i++) {
                var p = rightPieces[i];
                sq1State.group.remove(p.mesh);
                var sideColors = [];
                var oldMats = p.mesh.material;
                if (p.span === 60) {
                    sideColors = [oldMats[2].color.getHex(), oldMats[3].color.getHex()];
                } else {
                    sideColors = [oldMats[2].color.getHex()];
                }
                var newMesh = createSQ1Piece(p.span, p.layer === 'top', sideColors);
                p.mesh = newMesh;
                positionSQ1Piece(p);
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
