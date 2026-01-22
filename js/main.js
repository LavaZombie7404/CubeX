var currentPuzzle = 'pyraminx';
var sceneRef = null;
var currentPuzzleGroup = null;

document.addEventListener('DOMContentLoaded', function() {
    const viewerElement = document.getElementById('viewer');
    const { scene, camera, renderer, controls } = initScene(viewerElement);
    sceneRef = scene;

    // Create initial puzzle (pyraminx)
    currentPuzzleGroup = createPyraminx();
    scene.add(currentPuzzleGroup);

    setupPyraminxControls();
    setupCubeControls();
    setupMoveButtons();
    setupPuzzleSelector();

    // Initialize diagram for default puzzle
    initPyraminxDiagram();

    animate(renderer, scene, camera, controls);

    window.addEventListener('resize', function() {
        const width = viewerElement.clientWidth;
        const height = viewerElement.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
});

function setupPuzzleSelector() {
    const selector = document.getElementById('puzzle-select');
    const pyraminxMoves = document.getElementById('pyraminx-moves');
    const cubeMoves = document.getElementById('cube-moves');

    selector.addEventListener('change', function() {
        const puzzle = this.value;

        // Remove current puzzle
        if (currentPuzzleGroup) {
            sceneRef.remove(currentPuzzleGroup);
        }

        // Reset states
        pyraminxState.group = null;
        pyraminxState.pieces = [];
        pyraminxState.isAnimating = false;
        pyraminxState.animationQueue = [];

        cubeState.group = null;
        cubeState.cubies = [];
        cubeState.isAnimating = false;
        cubeState.animationQueue = [];

        // Create new puzzle
        if (puzzle === 'pyraminx') {
            currentPuzzleGroup = createPyraminx();
            pyraminxMoves.style.display = 'block';
            cubeMoves.style.display = 'none';
            initPyraminxDiagram();
        } else if (puzzle === 'cube2') {
            currentPuzzleGroup = createCube(2);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'block';
            initDiagram(2);
        } else if (puzzle === 'cube3') {
            currentPuzzleGroup = createCube(3);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'block';
            initDiagram(3);
        } else if (puzzle === 'cube4') {
            currentPuzzleGroup = createCube(4);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'block';
            initDiagram(4);
        }

        sceneRef.add(currentPuzzleGroup);
        currentPuzzle = puzzle;
    });
}

function setupMoveButtons() {
    // Pyraminx buttons
    const pyraminxButtons = document.querySelectorAll('#pyraminx-moves .move-btn');
    pyraminxButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            const reverse = this.dataset.reverse === 'true';
            rotatePyraminxLayer(move, !reverse, false);
        });
    });

    // Cube buttons
    const cubeButtons = document.querySelectorAll('#cube-moves .move-btn');
    cubeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            const reverse = this.dataset.reverse === 'true';
            rotateCubeLayer(move, !reverse);
        });
    });
}
