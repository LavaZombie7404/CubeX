document.addEventListener('DOMContentLoaded', function() {
    const viewerElement = document.getElementById('viewer');
    const { scene, camera, renderer, controls } = initScene(viewerElement);

    const pyraminx = createPyraminx();
    scene.add(pyraminx);

    setupPyraminxControls();
    setupMoveButtons();

    animate(renderer, scene, camera, controls);

    window.addEventListener('resize', function() {
        const width = viewerElement.clientWidth;
        const height = viewerElement.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
});

function setupMoveButtons() {
    const buttons = document.querySelectorAll('.move-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const move = this.dataset.move;
            const reverse = this.dataset.reverse === 'true';
            rotatePyraminxLayer(move, !reverse);
        });
    });
}
