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

### 1. Net Diagram (Unfolded Tetrahedron)

**Layout**: One central triangle with 3 triangles attached to each edge
```
        ____
       /\  /\
      /  \/  \
     / TOP \  \
    /________\
   /\   /\   /\
  /  \ /  \ /  \
 / L \/ F \/ R \
/____\/____\/____\
```
- Center: Front face (or any chosen face)
- Surrounding: Left, Right, Top (Back would be separate or folded)

**Alternative - Full unfold**:
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

### 2. Circular Projection

**Concept**: 4 faces arranged radially around center
```
        TOP
         △
        /|\
       / | \
   L  /  |  \  R
     △   |   △
      \  |  /
       \ | /
        \|/
         △
        FRONT

    (BACK shown separately or in center)
```

**Implementation**:
- 3 faces at 120° angles
- 4th face (back) as small indicator or center overlay
- Each face rendered as triangular grid of colored cells

### 3. Circular Intersection Diagram (Flower Style)

**Concept**: Adapt the cube's flower diagram for 4 axes

**Option A - 4 Circle Groups**:
```
           ○○○ (Axis U)
          / | \
         /  |  \
    ○○○ /   |   \ ○○○
   (L) (    |    ) (R)
        \   |   /
         \  |  /
          \ | /
           ○○○ (Axis B)
```
- 4 groups of concentric circles (one per axis)
- Arranged at 90° angles (square layout)
- Intersections form 4 face regions

**Option B - 3 Circle Groups** (simplified):
- Use 3 main axes, derive 4th
- Similar to cube's 120° arrangement
- Each intersection region = one face

**Circle count per group**:
- 2 circles: outer layer + inner layer
- (Tips are trivial, may not need representation)

### Intersection Mapping (Option A)

Each face is at intersection of 3 circle groups:
- **Front face**: U ∩ L ∩ R intersection
- **Left face**: U ∩ L ∩ B intersection
- **Right face**: U ∩ R ∩ B intersection
- **Bottom face**: L ∩ R ∩ B intersection

This is more complex than cube (where each face = 2 group intersection).

---

## Recommended Implementation Order

### Phase 1: Net Diagram
1. Render 4 triangular faces in unfolded layout
2. Each face shows 9 triangular stickers
3. Sync colors with `pyraminxState`
4. Simplest to implement, most readable

### Phase 2: Circular Projection
1. 3 faces at 120° + 1 face indicator
2. Triangular grid cells with colors
3. Good overview of puzzle state

### Phase 3: Flower/Circular Intersection
1. More complex due to 4 axes
2. May need simplified representation
3. Animation along circles for moves

---

## Technical Considerations

### Sticker Indexing
Need consistent mapping from 3D piece positions to 2D diagram positions:
```javascript
// Face sticker indices (0-8)
//        0
//      1 2 3
//    4 5 6 7 8
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
- Similar pattern to `updateDiagramFromCube()`

---

## Acceptance Criteria

### Net Diagram
- [ ] 4 triangular faces rendered in net layout
- [ ] 9 stickers per face with correct colors
- [ ] Colors sync with 3D Pyraminx rotations

### Circular Projection
- [ ] 4 faces arranged radially
- [ ] Clear visual distinction between faces
- [ ] Colors sync with 3D rotations

### Flower Diagram (Stretch)
- [ ] Circle groups representing axes
- [ ] Dots at intersection points
- [ ] Animated movement along circles

---

## References
- Cube flower diagram: `docs/TICKET-001-flower-diagram.md`
- Pyraminx 3D code: `js/pyraminx.js`
- Diagram renderer: `js/diagram.js`
