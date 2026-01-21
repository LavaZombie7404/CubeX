import { initScene, animate } from './scene.js';
import { createPyraminx } from './pyraminx.js';

const viewerElement = document.getElementById('viewer');
const { scene, camera, renderer, controls } = initScene(viewerElement);

const pyraminx = createPyraminx();
scene.add(pyraminx);

animate(renderer, scene, camera, controls);

window.addEventListener('resize', () => {
    const width = viewerElement.clientWidth;
    const height = viewerElement.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
