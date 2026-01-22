# TICKET-001: Flower Diagram (Circle Net Projection)

## Status: In Progress

## Description
Implement a "Flower" diagram visualization for the Rubik's cube that uses intersecting concentric circles to represent the cube state and animate moves.

## Visual Structure

### Circle Groups
- **3 groups** of concentric circles (one per rotation axis: X, Y, Z)
- Each group has **3 circles** (for 3x3 cube) or **2 circles** (for 2x2)
- Groups positioned at **120° angles** from each other
- Creates a Venn diagram-like pattern

### Layout
```
           Group A (Top/Bottom axis - Y)
                 ○○○
                /   \
               /     \
        Group B       Group C
    (Left/Right-X)  (Front/Back-Z)
           ○○○         ○○○
```

### Intersections = Cube Faces
- Each pair of circle groups intersects at **2 locations**
- These 6 intersection regions represent the **6 cube faces**
- Mapping:
  - Group A ∩ Group B → Left & Right faces
  - Group B ∩ Group C → Front & Back faces
  - Group A ∩ Group C → Top & Bottom faces

### Sticker Representation
- Small colored dots at circle intersection points
- For 3x3: 9 dots per face (54 total)
- For 2x2: 4 dots per face (24 total)
- Dot color = sticker color

## Animation Behavior

### Move Animation
When a cube layer rotates:
1. Identify which circle corresponds to that layer
2. Dots on that layer animate **along the circle path**
3. Animation duration syncs with 3D cube rotation (300ms)
4. Dots smoothly transition to new positions

### Example: U Move (Top Layer)
- Top layer corresponds to outermost circle of Group A
- All 8 edge/corner stickers on top face move along this circle
- Center sticker stays fixed

## Implementation Notes

### Circle Centers
- Group A center: top of diagram
- Group B center: bottom-left
- Group C center: bottom-right
- Distance between centers determined by face size

### Synchronization
- `updateDiagramFromCube()` called after each 3D rotation
- For animation: intercept rotation start, animate dots, then update colors

## Acceptance Criteria
- [ ] 3 groups of concentric circles rendered correctly
- [ ] 6 face regions visible at intersections
- [ ] Colored dots at correct positions
- [ ] Dots update when 3D cube rotates
- [ ] (Stretch) Animated dot movement along circles

## Reference
See `/tmp/screen2.png` for visual reference of target diagram style.

## Technical Approach
- Use D3.js for SVG rendering
- Calculate circle intersections mathematically
- Store dot positions mapped to cube face/sticker indices
- Sync with `cubeState` for colors

## Iterations
1. **v1**: Static diagram with correct structure
2. **v2**: Sync colors with 3D cube state
3. **v3**: Animated transitions along circles
