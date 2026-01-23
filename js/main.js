var currentPuzzle = 'cube3';
var sceneRef = null;
var currentPuzzleGroup = null;
var currentFigure = 'block';

document.addEventListener('DOMContentLoaded', function() {
    const viewerElement = document.getElementById('viewer');
    const { scene, camera, renderer, controls } = initScene(viewerElement);
    sceneRef = scene;

    // Create initial puzzle (3x3 cube)
    currentPuzzleGroup = createCube(3);
    scene.add(currentPuzzleGroup);

    setupPyraminxControls();
    setupCubeControls();
    setupMoveButtons();
    setupPuzzleSelector();
    setupCuboidButtons();
    setupFigureSelector();

    // Initialize diagram for default puzzle
    initDiagram(3);

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
    const cuboidMoves = document.getElementById('cuboid-moves');
    const diagramPanel = document.getElementById('diagram-panel');
    const figureSection = document.getElementById('figure-section');
    const figureSelect = document.getElementById('figure-select');

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
            pyraminxMoves.style.display = 'flex';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            initPyraminxDiagram();
        } else if (puzzle === 'cube2') {
            currentPuzzleGroup = createCube(2);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            initDiagram(2);
        } else if (puzzle === 'cube3') {
            currentPuzzleGroup = createCube(3);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            initDiagram(3);
        } else if (puzzle === 'cube4') {
            currentPuzzleGroup = createCube(4);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            initDiagram(4);
        } else if (puzzle === 'cuboid1x2x3') {
            currentFigure = figureSelect.value;
            currentPuzzleGroup = createCuboid(1, 2, 3, currentFigure);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'flex';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'block';
            // Show correct move buttons for current figure
            updateCuboidMoveButtons(currentFigure);
            // Clear diagram for cuboid (no diagram yet)
            clearDiagram();
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

function setupCuboidButtons() {
    const cuboidButtons = document.querySelectorAll('.cuboid-btn');
    cuboidButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            rotateCubeLayer(move, true); // 180° moves ignore direction
        });
    });
}

function setupFigureSelector() {
    const figureSelect = document.getElementById('figure-select');

    figureSelect.addEventListener('change', function() {
        const figure = this.value;
        if (figure === currentFigure) return;

        // Transform to figure
        transformToFigure(figure);
        currentFigure = figure;
    });
}

function updateCuboidMoveButtons(figure) {
    const treeMoves = document.getElementById('tree-moves');
    const blockMoves = document.getElementById('block-moves');

    if (figure === 'tree') {
        treeMoves.style.display = 'block';
        blockMoves.style.display = 'none';
    } else {
        treeMoves.style.display = 'none';
        blockMoves.style.display = 'block';
    }
}

function transformToFigure(targetFigure) {
    // Recreate cuboid with the new figure shape
    if (currentPuzzleGroup) {
        sceneRef.remove(currentPuzzleGroup);
    }

    cubeState.group = null;
    cubeState.cubies = [];
    cubeState.isAnimating = false;
    cubeState.animationQueue = [];

    currentPuzzleGroup = createCuboid(1, 2, 3, targetFigure);
    sceneRef.add(currentPuzzleGroup);

    // Show correct move buttons for figure
    updateCuboidMoveButtons(targetFigure);
}
