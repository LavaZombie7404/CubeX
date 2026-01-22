# TICKET-002: Pyraminx Diagram Visualizations

## Status: Planning

## Pyraminx Structure Analysis

### Geometry
- **Shape**: Regular tetrahedron (4 triangular faces)
- **Faces**: 4 (vs cube's 6)
- **Vertices**: 4 (each is a rotation axis)
- **Edges**: 6

### Stickers Per Face
Each triangular face contains **9 triangular stickers** arranged in rows:
```
       △        (row 1: 1 tip)
      ▽ △ ▽     (row 2: 3 pieces)
     △ ▽ △ ▽ △  (row 3: 5 pieces)
```
- **Total stickers**: 9 × 4 = 36
- Orientation: alternating up/down triangles

### Piece Types
| Type | Count | Description |
|------|-------|-------------|
| Tips | 4 | Trivial corners (rotate independently) |
| Axial | 4 | Centers adjacent to tips |
| Edges | 6 | Shared between 2 faces |

### Rotation Axes
- **4 axes** (one through each vertex → opposite face center)
- Each axis controls layers parallel to the opposite face
- Moves: U (top), L (left), R (right), B (back)

### Colors
- **4 colors** (one per face): typically green, red, blue, yellow
- Each color appears on **9 stickers**

## Comparison: Cube vs Pyraminx

| Property | Rubik's Cube | Pyraminx |
|----------|--------------|----------|
| Faces | 6 | 4 |
| Stickers/face | 9 (3×3) | 9 (triangle) |
| Total stickers | 54 | 36 |
| Rotation axes | 3 (X,Y,Z) | 4 (vertices) |
| Face shape | Square | Triangle |
| Layers/axis | 3 | 3 (tip + 2 layers) |

---

## Proposed Diagram Views

### 1. Net Diagram (Full Unfold)

**Layout**: Tetrahedron fully unfolded - one central face with 3 faces attached
```
         /\
        /  \
       / B  \
      /______\
     /\      /\
    /  \    /  \
   / L  \  / R  \
  /______\/______\
        /\
       /  \
      / F  \
     /______\
```

- **Center row**: Back face at top, Left and Right flanking
- **Bottom**: Front face
- All 4 faces visible in single view
- Natural unfolding of tetrahedron

**Sticker layout per face** (9 triangles):
```
       0
      1 2 3
     4 5 6 7 8
```
- Index 0: tip triangle
- Indices 1,3: edge triangles (shared with adjacent faces)
- Index 2: axial center
- Indices 4,8: edge triangles
- Indices 5,6,7: inner triangles

### 2. Circular Projection

**Concept**: 4 faces arranged radially around center
```
        B
        △
       /|\
      / | \
  L  /  |  \  R
    △   |   △
     \  |  /
      \ | /
       \|/
        △
        F
```

- 3 outer faces at 120° angles (L, R, B)
- 1 center/bottom face (F)
- Each face rendered as triangular grid

---

## Technical Considerations

### Sticker Indexing
```javascript
// Face sticker indices (0-8)
//        0
//      1 2 3
//    4 5 6 7 8

// Up-pointing triangles: 0, 2, 4, 6, 8
// Down-pointing triangles: 1, 3, 5, 7
```

### Color Reading
```javascript
function getPyraminxFaceColors(face) {
    // Return array of 9 colors for the face
    // Based on pyraminxState piece positions/orientations
}
```

### Synchronization
- Call `updatePyraminxDiagram()` after each rotation
- Map 3D piece positions to 2D sticker indices

---

## Acceptance Criteria

### Net Diagram
- [ ] 4 triangular faces rendered in full unfold layout
- [ ] 9 triangular stickers per face with correct colors
- [ ] Up/down triangle orientations correct
- [ ] Colors sync with 3D Pyraminx rotations

### Circular Projection
- [ ] 4 faces arranged radially (3 outer + 1 center)
- [ ] Clear visual distinction between faces
- [ ] Colors sync with 3D rotations

---

## References
- Pyraminx 3D code: `js/pyraminx.js`
- Diagram renderer: `js/diagram.js`
