import * as THREE from 'three';

const COLORS = {
    red: 0xe94560,
    green: 0x4ecca3,
    blue: 0x3498db,
    yellow: 0xf1c40f
};

export function createPyraminx() {
    const group = new THREE.Group();

    const h = Math.sqrt(2 / 3);
    const vertices = [
        new THREE.Vector3(0, h, 0),
        new THREE.Vector3(-0.5, -h / 3, Math.sqrt(3) / 6),
        new THREE.Vector3(0.5, -h / 3, Math.sqrt(3) / 6),
        new THREE.Vector3(0, -h / 3, -Math.sqrt(3) / 3)
    ];

    const faces = [
        { verts: [0, 1, 2], color: COLORS.red },
        { verts: [0, 2, 3], color: COLORS.green },
        { verts: [0, 3, 1], color: COLORS.blue },
        { verts: [1, 3, 2], color: COLORS.yellow }
    ];

    faces.forEach(face => {
        const v0 = vertices[face.verts[0]];
        const v1 = vertices[face.verts[1]];
        const v2 = vertices[face.verts[2]];
        const triangles = subdivideFace(v0, v1, v2, 3);

        triangles.forEach(tri => {
            const mesh = createTriangleMesh(tri, face.color);
            group.add(mesh);
        });
    });

    return group;
}

function subdivideFace(v0, v1, v2, divisions) {
    const triangles = [];

    for (let row = 0; row < divisions; row++) {
        const rowStart0 = v0.clone().lerp(v1, row / divisions);
        const rowStart1 = v0.clone().lerp(v2, row / divisions);
        const nextRowStart0 = v0.clone().lerp(v1, (row + 1) / divisions);
        const nextRowStart1 = v0.clone().lerp(v2, (row + 1) / divisions);

        const trianglesInRow = row * 2 + 1;

        for (let col = 0; col <= row; col++) {
            const t = row === 0 ? 0 : col / row;
            const tNext = (row + 1) === 0 ? 0 : col / (row + 1);
            const tNextPlus = (row + 1) === 0 ? 0 : (col + 1) / (row + 1);

            const top = rowStart0.clone().lerp(rowStart1, t);
            const bottomLeft = nextRowStart0.clone().lerp(nextRowStart1, tNext);
            const bottomRight = nextRowStart0.clone().lerp(nextRowStart1, tNextPlus);

            triangles.push([top, bottomLeft, bottomRight]);

            if (col < row) {
                const tPlus = col / row;
                const tPlusNext = (col + 1) / row;
                const topRight = rowStart0.clone().lerp(rowStart1, tPlusNext);

                triangles.push([top, bottomRight, topRight]);
            }
        }
    }

    return triangles;
}

function createTriangleMesh(vertices, color) {
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array([
        vertices[0].x, vertices[0].y, vertices[0].z,
        vertices[1].x, vertices[1].y, vertices[1].z,
        vertices[2].x, vertices[2].y, vertices[2].z
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
        color: color,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    mesh.add(line);

    return mesh;
}
