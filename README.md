<div align="center">

# <img src="https://img.shields.io/badge/3D-Puzzle_Simulator-blueviolet?style=for-the-badge" alt="3D Puzzle Simulator"/> CubeX

### Interactive 3D Twisty Puzzle Simulator & Solver

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-blue?style=for-the-badge&logo=github)](https://lavazombie7404.github.io/CubeX/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js)](https://threejs.org/)

<br/>

**[Launch App](https://lavazombie7404.github.io/CubeX/)** | **[Report Bug](https://github.com/LavaZombie7404/CubeX/issues)** | **[Request Feature](https://github.com/LavaZombie7404/CubeX/issues)**

<br/>

*Manipulate, scramble, and solve 11 different twisty puzzles right in your browser &mdash; no install required.*

</div>

---

## About

CubeX is a browser-based 3D simulator for twisty puzzles. It renders interactive puzzles using Three.js and provides real-time 2D state diagrams powered by D3.js. Control puzzles with keyboard shortcuts, on-screen buttons, or touch gestures. Features include random scrambling, solve assistance, webcam color detection, and alternate figure shapes like mirrors and trees.

## Supported Puzzles

| Puzzle | Sizes / Variants |
|:-------|:-----------------|
| **NxN Cubes** | 1x1, 2x2, 3x3, 4x4, 5x5, 6x6, 7x7 |
| **Pyraminx** | Standard tetrahedral puzzle |
| **Square-1** | Shape-shifting with slice mechanics |
| **1x3x3 Floppy Cube** | Block & mirror figures |
| **1x2x3 Cuboid** | Block, tree & mirror figures |

## Features

- **Real-time 3D rendering** &mdash; smooth quaternion-based animations at 60 fps
- **2D state diagrams** &mdash; net and circular views that sync with every move
- **Keyboard controls** &mdash; standard notation (U, D, L, R, F, B), modifiers for inverse/inner slices
- **Scramble & Solve** &mdash; one-click random scrambles and move-history reversal; BFS optimal solver for the floppy cube
- **Alternate figures** &mdash; mirror cubes with selectable colors and a Christmas-tree cuboid
- **Webcam integration** &mdash; HSV color detection with calibration for reading physical cube states
- **Responsive dark theme** &mdash; works on desktop and touch devices

## Controls

| Input | Action |
|:------|:-------|
| `U` `D` `L` `R` `F` `B` | Rotate the corresponding face clockwise |
| `Shift` + key | Counter-clockwise (inverse) move |
| `M` `S` | Middle and standing slice moves |
| `Ctrl` + digit + move | Inner slice at a specific depth (4x4+) |
| Mouse drag | Orbit the camera |
| Scroll wheel | Zoom in / out |
| `/` | Slice move (Square-1) |

## Tech Stack

| Technology | Role |
|:-----------|:-----|
| **Three.js** | 3D WebGL rendering |
| **D3.js** | 2D SVG diagrams |
| **OpenCV.js** | Camera color detection |
| **Vanilla JS / HTML / CSS** | Application logic & UI |

## Project Structure

```
CubeX/
├── index.html        # Single-page entry point
├── css/
│   └── style.css     # Dark theme & responsive layout
├── js/
│   ├── main.js       # UI setup, puzzle switching, scramble/solve
│   ├── cube.js       # All NxN cubes, floppy, cuboid logic & solver
│   ├── pyraminx.js   # Tetrahedral puzzle mechanics
│   ├── sq1.js        # Square-1 geometry & slice rules
│   ├── diagram.js    # 2D net & circular diagram rendering
│   ├── camera.js     # Webcam capture & HSV color detection
│   └── scene.js      # Three.js scene, lights & render loop
└── docs/             # Design tickets & notes
```

## Getting Started

No build step required. Clone and open `index.html` in any modern browser:

```bash
git clone https://github.com/LavaZombie7404/CubeX.git
cd CubeX
# open index.html in your browser, or:
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">
<sub>Built with Three.js, D3.js, and a love for twisty puzzles.</sub>
</div>
