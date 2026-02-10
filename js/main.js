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
    setupSQ1Controls();
    setupMoveButtons();
    setupPuzzleSelector();
    setupCuboidButtons();
    setupFigureSelector();
    setupFloppyFigureSelector();
    setupCube1FigureSelector();
    setupScrambleButton();
    setupSolveButton();

    // Initialize diagram for default puzzle
    initDiagram(3);

    // Initialize camera module
    initCamera();

    animate(renderer, scene, camera, controls);

    window.addEventListener('resize', function() {
        const width = viewerElement.clientWidth;
        const height = viewerElement.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        handleCameraResize();
    });

    window.addEventListener('beforeunload', function() {
        cleanupCamera();
    });
});

function setupPuzzleSelector() {
    const selector = document.getElementById('puzzle-select');
    const pyraminxMoves = document.getElementById('pyraminx-moves');
    const cubeMoves = document.getElementById('cube-moves');
    const cuboidMoves = document.getElementById('cuboid-moves');
    const floppyMoves = document.getElementById('floppy-moves');
    const sq1Moves = document.getElementById('sq1-moves');
    const diagramPanel = document.getElementById('diagram-panel');
    const figureSection = document.getElementById('figure-section');
    const figureSelect = document.getElementById('figure-select');
    const floppyFigureSection = document.getElementById('floppy-figure-section');
    const floppyFigureSelect = document.getElementById('floppy-figure-select');
    const mirrorColorSection = document.getElementById('mirror-color-section');
    const mirrorColorSelect = document.getElementById('mirror-color-select');
    const cube1FigureSection = document.getElementById('cube1-figure-section');
    const cube1FigureSelect = document.getElementById('cube1-figure-select');

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

        sq1State.group = null;
        sq1State.pieces = [];
        sq1State.middleMeshes = [];
        sq1State.isAnimating = false;
        sq1State.animationQueue = [];

        // Create new puzzle
        if (puzzle === 'pyraminx') {
            currentPuzzleGroup = createPyraminx();
            pyraminxMoves.style.display = 'flex';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = 'none';
            initPyraminxDiagram();
        } else if (puzzle === 'cube1') {
            var cube1Figure = cube1FigureSelect.value;
            var cube1Color = mirrorColorSelect.value;
            currentPuzzleGroup = createCube(1, cube1Figure, cube1Color);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'none';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'block';
            mirrorColorSection.style.display = cube1Figure === 'mirror' ? 'block' : 'none';
        } else if (puzzle === 'cube2') {
            currentPuzzleGroup = createCube(2);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = 'none';
            initDiagram(2);
        } else if (puzzle === 'cube3') {
            currentPuzzleGroup = createCube(3);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = 'none';
            initDiagram(3);
        } else if (puzzle === 'cube4' || puzzle === 'cube5' || puzzle === 'cube6' || puzzle === 'cube7') {
            var cubeSize = parseInt(puzzle.replace('cube', ''));
            currentPuzzleGroup = createCube(cubeSize);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'flex';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = 'none';
            initDiagram(cubeSize);
        } else if (puzzle === 'floppy') {
            const floppyFigure = floppyFigureSelect.value;
            const mirrorColor = mirrorColorSelect.value;
            currentPuzzleGroup = createFloppyCube(floppyFigure, mirrorColor);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'flex';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'block';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = floppyFigure === 'mirror' ? 'block' : 'none';
            clearDiagram();
        } else if (puzzle === 'cuboid1x2x3') {
            currentFigure = figureSelect.value;
            var cuboidColor = mirrorColorSelect.value;
            currentPuzzleGroup = createCuboid(1, 2, 3, currentFigure, cuboidColor);
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'flex';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'none';
            diagramPanel.style.display = 'flex';
            figureSection.style.display = 'block';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = currentFigure === 'mirror' ? 'block' : 'none';
            // Show correct move buttons for current figure
            updateCuboidMoveButtons(currentFigure);
            // Clear diagram for cuboid (no diagram yet)
            clearDiagram();
        } else if (puzzle === 'sq1') {
            currentPuzzleGroup = createSquareOne();
            pyraminxMoves.style.display = 'none';
            cubeMoves.style.display = 'none';
            cuboidMoves.style.display = 'none';
            floppyMoves.style.display = 'none';
            sq1Moves.style.display = 'flex';
            diagramPanel.style.display = 'none';
            figureSection.style.display = 'none';
            floppyFigureSection.style.display = 'none';
            cube1FigureSection.style.display = 'none';
            mirrorColorSection.style.display = 'none';
        }

        sceneRef.add(currentPuzzleGroup);
        currentPuzzle = puzzle;

        // Clear move history on puzzle change
        moveHistory = [];

        // Update camera overlay guide for new puzzle
        updateCameraGuide();
    });
}

function setupMoveButtons() {
    // Pyraminx buttons (Ctrl = tip only, default = wide layer)
    const pyraminxButtons = document.querySelectorAll('#pyraminx-moves .move-btn');
    pyraminxButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const move = this.dataset.move;
            const reverse = this.dataset.reverse === 'true';
            rotatePyraminxLayer(move, !reverse, !e.ctrlKey);
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

    // SQ-1 buttons
    const sq1Buttons = document.querySelectorAll('#sq1-moves .sq1-btn');
    sq1Buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            const amount = parseInt(this.dataset.amount);
            if (move === 'slice') {
                if (canSliceSQ1()) {
                    sliceSQ1();
                }
            } else {
                rotateSQ1Layer(move, amount);
            }
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

    // Setup floppy buttons with 180° rotations
    const floppyButtons = document.querySelectorAll('#floppy-moves .floppy-btn');
    floppyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            rotateCubeLayer(move, true);
        });
    });
}

function setupFigureSelector() {
    const figureSelect = document.getElementById('figure-select');
    const mirrorColorSection = document.getElementById('mirror-color-section');
    const mirrorColorSelect = document.getElementById('mirror-color-select');

    figureSelect.addEventListener('change', function() {
        const figure = this.value;
        if (figure === currentFigure) return;

        mirrorColorSection.style.display = figure === 'mirror' ? 'block' : 'none';

        // Transform to figure
        moveHistory = [];
        transformToFigure(figure);
        currentFigure = figure;
    });

    mirrorColorSelect.addEventListener('change', function() {
        if (currentPuzzle !== 'cuboid1x2x3') return;
        if (currentFigure !== 'mirror') return;
        moveHistory = [];
        transformToFigure('mirror');
    });
}

function setupFloppyFigureSelector() {
    const floppyFigureSelect = document.getElementById('floppy-figure-select');
    const mirrorColorSelect = document.getElementById('mirror-color-select');
    const mirrorColorSection = document.getElementById('mirror-color-section');

    floppyFigureSelect.addEventListener('change', function() {
        const figure = this.value;
        const color = mirrorColorSelect.value;

        // Show/hide color selector
        mirrorColorSection.style.display = figure === 'mirror' ? 'block' : 'none';
        moveHistory = [];

        // Recreate floppy cube with new figure
        if (currentPuzzleGroup) {
            sceneRef.remove(currentPuzzleGroup);
        }
        cubeState.group = null;
        cubeState.cubies = [];
        cubeState.isAnimating = false;
        cubeState.animationQueue = [];

        currentPuzzleGroup = createFloppyCube(figure, color);
        sceneRef.add(currentPuzzleGroup);
    });

    mirrorColorSelect.addEventListener('change', function() {
        const figure = floppyFigureSelect.value;
        const color = this.value;

        if (figure !== 'mirror') return;
        moveHistory = [];

        // Recreate mirror cube with new color
        if (currentPuzzleGroup) {
            sceneRef.remove(currentPuzzleGroup);
        }
        cubeState.group = null;
        cubeState.cubies = [];
        cubeState.isAnimating = false;
        cubeState.animationQueue = [];

        currentPuzzleGroup = createFloppyCube(figure, color);
        sceneRef.add(currentPuzzleGroup);
    });
}

function setupCube1FigureSelector() {
    var cube1FigureSelect = document.getElementById('cube1-figure-select');
    var mirrorColorSection = document.getElementById('mirror-color-section');
    var mirrorColorSelect = document.getElementById('mirror-color-select');

    cube1FigureSelect.addEventListener('change', function() {
        var figure = this.value;
        var color = mirrorColorSelect.value;

        mirrorColorSection.style.display = figure === 'mirror' ? 'block' : 'none';
        moveHistory = [];

        if (currentPuzzleGroup) {
            sceneRef.remove(currentPuzzleGroup);
        }
        cubeState.group = null;
        cubeState.cubies = [];
        cubeState.isAnimating = false;
        cubeState.animationQueue = [];

        currentPuzzleGroup = createCube(1, figure, color);
        sceneRef.add(currentPuzzleGroup);
    });

    mirrorColorSelect.addEventListener('change', function() {
        if (currentPuzzle !== 'cube1') return;
        var figure = cube1FigureSelect.value;
        if (figure !== 'mirror') return;
        var color = this.value;
        moveHistory = [];

        if (currentPuzzleGroup) {
            sceneRef.remove(currentPuzzleGroup);
        }
        cubeState.group = null;
        cubeState.cubies = [];
        cubeState.isAnimating = false;
        cubeState.animationQueue = [];

        currentPuzzleGroup = createCube(1, 'mirror', color);
        sceneRef.add(currentPuzzleGroup);
    });
}

function setupScrambleButton() {
    const scrambleBtn = document.getElementById('scramble-btn');

    scrambleBtn.addEventListener('click', function() {
        // Clear history so solve undoes only from this scramble
        moveHistory = [];

        // Disable button during scramble
        scrambleBtn.disabled = true;
        scrambleBtn.textContent = 'Scrambling...';

        function onComplete() {
            scrambleBtn.disabled = false;
            scrambleBtn.textContent = 'Scramble';
        }

        if (currentPuzzle === 'pyraminx') {
            scramblePyraminx(15, onComplete);
        } else if (currentPuzzle === 'floppy') {
            scrambleFloppyCube(10, onComplete);
        } else if (currentPuzzle === 'sq1') {
            scrambleSQ1(20, onComplete);
        } else if (currentPuzzle.startsWith('cube') || currentPuzzle.startsWith('cuboid')) {
            scrambleCube(null, onComplete);
        }
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

    var color = document.getElementById('mirror-color-select').value;
    currentPuzzleGroup = createCuboid(1, 2, 3, targetFigure, color);
    sceneRef.add(currentPuzzleGroup);

    // Show correct move buttons for figure
    updateCuboidMoveButtons(targetFigure);
}

function setupSolveButton() {
    const solveBtn = document.getElementById('solve-btn');

    solveBtn.addEventListener('click', function() {
        if (cubeState.isAnimating || pyraminxState.isAnimating || sq1State.isAnimating) return;

        solveBtn.disabled = true;
        solveBtn.textContent = 'Solving...';

        setTimeout(function() {
            function onDone(count) {
                solveBtn.textContent = count > 0 ? 'Solved in ' + count + ' moves' : 'Solved!';
                setTimeout(function() {
                    solveBtn.disabled = false;
                    solveBtn.textContent = 'Solve';
                }, 1500);
            }

            if (currentPuzzle === 'floppy') {
                // BFS optimal solver for floppy cube
                const solution = solveFloppyCube();

                if (solution === null) {
                    solveBtn.textContent = 'Error';
                    setTimeout(function() {
                        solveBtn.disabled = false;
                        solveBtn.textContent = 'Solve';
                    }, 1500);
                    return;
                }

                if (solution.length === 0) {
                    onDone(0);
                    return;
                }

                var count = solution.length;
                solveBtn.textContent = 'Solving (' + count + ' moves)...';
                isSolving = true;
                moveHistory = [];
                executeFloppySolution(solution, function() {
                    isSolving = false;
                    onDone(count);
                });
            } else {
                // History reversal for all other puzzles
                if (moveHistory.length === 0) {
                    onDone(0);
                    return;
                }

                var count = moveHistory.length;
                solveBtn.textContent = 'Solving (' + count + ' moves)...';
                solveFromHistory(function() {
                    onDone(count);
                });
            }
        }, 50);
    });
}
