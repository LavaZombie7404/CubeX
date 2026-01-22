const CUBE_COLORS = {
    top: 0xffffff,      // white
    bottom: 0xffff00,   // yellow
    front: 0xff0000,    // red
    back: 0xffa500,     // orange
    right: 0x0000ff,    // blue
    left: 0x00ff00      // green
};

const CUBIE_SIZE = 0.45;
const GAP = 0.02;

var cubeState = {
    group: null,
    cubies: [],
    size: 2,
    isAnimating: false,
    animationQueue: []
};

function createCube(size) {
    size = size || 2;
    cubeState.size = size;
    cubeState.group = new THREE.Group();
    cubeState.cubies = [];

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                const cubie = createCubie(x, y, z, size);
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

function createCubie(x, y, z, size) {
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE * 2, CUBIE_SIZE * 2, CUBIE_SIZE * 2);

    // Determine which faces are visible (on the outside)
    const materials = [];

    // Right face (+X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === size - 1 ? CUBE_COLORS.right : 0x111111
    }));
    // Left face (-X)
    materials.push(new THREE.MeshLambertMaterial({
        color: x === 0 ? CUBE_COLORS.left : 0x111111
    }));
    // Top face (+Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === size - 1 ? CUBE_COLORS.top : 0x111111
    }));
    // Bottom face (-Y)
    materials.push(new THREE.MeshLambertMaterial({
        color: y === 0 ? CUBE_COLORS.bottom : 0x111111
    }));
    // Front face (+Z)
    materials.push(new THREE.MeshLambertMaterial({
        color: z === size - 1 ? CUBE_COLORS.front : 0x111111
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

    const axis = getRotationAxis(face);
    const layerCubies = getCubiesInLayer(face);

    if (layerCubies.length === 0) return;

    cubeState.isAnimating = true;

    const angle = clockwise ? -Math.PI / 2 : Math.PI / 2;
    // Adjust direction for certain faces
    const adjustedAngle = ['left', 'bottom', 'back'].includes(face) ? -angle : angle;

    animateCubeRotation(layerCubies, axis, adjustedAngle, 300, clockwise, function() {
        cubeState.isAnimating = false;

        if (onComplete) onComplete();

        if (cubeState.animationQueue.length > 0) {
            const next = cubeState.animationQueue.shift();
            rotateCubeLayer(next.face, next.clockwise, next.onComplete);
        }
    });
}

function getRotationAxis(face) {
    switch (face) {
        case 'right':
        case 'left':
            return new THREE.Vector3(1, 0, 0);
        case 'top':
        case 'bottom':
            return new THREE.Vector3(0, 1, 0);
        case 'front':
        case 'back':
            return new THREE.Vector3(0, 0, 1);
        default:
            return new THREE.Vector3(0, 1, 0);
    }
}

function getCubiesInLayer(face) {
    const threshold = 0.1;
    const layerPos = (cubeState.size - 1) / 2 * (CUBIE_SIZE * 2 + GAP);

    return cubeState.cubies.filter(cubie => {
        const pos = cubie.position;
        switch (face) {
            case 'right':
                return pos.x > layerPos - threshold;
            case 'left':
                return pos.x < -layerPos + threshold;
            case 'top':
                return pos.y > layerPos - threshold;
            case 'bottom':
                return pos.y < -layerPos + threshold;
            case 'front':
                return pos.z > layerPos - threshold;
            case 'back':
                return pos.z < -layerPos + threshold;
            default:
                return false;
        }
    });
}

function animateCubeRotation(cubies, axis, targetAngle, duration, clockwise, onComplete) {
    const startTime = performance.now();
    const pivot = new THREE.Vector3(0, 0, 0);

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
        if (typeof cubeState.group === 'undefined' || cubeState.group === null) return;

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
                rotateCubeLayer('back', clockwise);
                break;
        }
    });
}
