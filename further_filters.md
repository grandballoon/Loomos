# Further Filter Options — Research Notes

These are design suggestions for four additional pre-processing filters for the crosshair utility.
No code is proposed here; this is a survey of how Photoshop and Pillow (with named companion libraries where Pillow alone falls short) could implement each one mechanically.

## The mechanical-vs-generative line

Every filter below is required to be a *measurement* of the actual image, not a generative re-rendering of it.
A mechanical filter reads the real pixels, computes edges, regions, or landmarks from them, and draws a deterministic result whose geometry is traceable back to the input.
A generative model instead hallucinates a plausible new image and discards the original geometry; that is explicitly out of scope.
For filters 1 and 2 this distinction is clean, because classical computer vision covers them entirely.
For filters 3 and 4 the honest position is spelled out in each section: robust anatomical detection realistically uses learned keypoint models, but those models *detect and measure* the real image, and the final drawing is computed geometry laid over those measurements — not a generated picture.
A strictly no-neural-network fallback is given for both, at reduced fidelity.

## How each would slot into the utility

Each filter would become a `--filter <name>` pre-processing stage applied to the already-resized image, before `drawImage` embeds it.
The existing crosshair overlay is unaffected: it is still drawn as vector lines on top of the filtered raster.
This keeps the discrete-function architecture intact — one new pure function per filter, `image -> image`, inserted between `prepare_image` and `render_pdf`.

---

## Filter 1 — Edge-preserving line drawing

### Target
A black-and-white or grayscale line rendering that keeps every real shape and edge of the source, with no invented detail.

### Photoshop
`Filter > Stylize > Find Edges` is the direct built-in: it runs an edge operator and returns dark lines on white.
`Image > Adjustments > Threshold` then collapses the result to pure 1-bit black and white if a hard line is wanted.
`Filter > Filter Gallery > Sketch > Photocopy` and `Graphic Pen` approximate the same look with directional strokes.
The widely documented "pencil-sketch" technique is fully mechanical and worth naming: desaturate, duplicate the layer, invert it, set the blend mode to Color Dodge, then Gaussian-blur the top layer — the blur radius controls line weight.
`Filter > Other > High Pass` isolates the high-frequency edge band directly, and `Filter > Other > Custom` accepts a raw convolution matrix, so a Sobel kernel can be entered by hand.

### Pillow
`Image.convert("L")` produces the luminance-weighted grayscale base.
`ImageFilter.FIND_EDGES` and `ImageFilter.CONTOUR` are the native edge kernels (Laplacian-style); `ImageFilter.Kernel(...)` lets a custom Sobel or Prewitt matrix be supplied.
The Difference-of-Gaussians look is reproducible with two `ImageFilter.GaussianBlur` passes at different radii combined via `ImageChops.subtract`.
`Image.point(...)` with a threshold, or `Image.convert("1")` for dithered bilevel, gives the final hard black-and-white.
The Color-Dodge sketch recipe maps onto `ImageChops` operations (invert, blur, dodge) for the same tonal-line result.

### Core algorithms behind the buttons
Sobel and Prewitt are first-derivative gradient operators; the Laplacian is a second-derivative operator; both are what `Find Edges` and `FIND_EDGES` approximate.
Canny (gradient, non-maximum suppression, then double-threshold hysteresis) is the gold standard for clean, thin, connected lines and is the recommended target quality.
XDoG — the Extended Difference-of-Gaussians (Winnemöller et al., 2012) — is the citable mechanical technique for a stylized hand-drawn line and is directly tunable between crisp and sketchy.
Morphological thinning (medial-axis skeletonization) reduces thick edges to single-pixel strokes when a true line drawing rather than an edge mask is wanted.

### Pillow's gap
Pillow has no native Canny; `FIND_EDGES` is noisier and thicker.
For production quality, pair Pillow with `cv2.Canny` (OpenCV) or `skimage.feature.canny` (scikit-image) for the detection step and keep Pillow for the compositing and output.

---

## Filter 2 — Geometric-form abstraction (Master Copy)

### Target
The image reduced to major shape groups — triangles, rectangles, polygons — in the spirit of an art student's block-in of a Renaissance painting, with the real composition preserved.

### Two mechanical families
Region segmentation flattens the image into solid-color areas, and each area becomes a shape: color quantization (median-cut or k-means), posterization, or superpixel clustering.
Primitive fitting instead places explicit geometric primitives to approximate the image: low-poly Delaunay triangulation, or an optimizer that adds shapes one at a time.

### Photoshop
`Filter > Filter Gallery > Artistic > Cutout` is the closest native match: it renders the image as flat, cut-paper shape regions, with sliders for the number of levels and edge simplicity.
`Filter > Pixelate > Crystallize` builds solid-color polygonal (Voronoi) cells; `Mosaic` gives rectangular blocks; `Facet` clumps similar pixels into flat facets.
`Image > Adjustments > Posterize` reduces the tonal range so regions merge into shapes, and `Poster Edges` adds outline emphasis.
Photoshop cannot truly triangulate or vectorize; Illustrator's `Image Trace` is the Adobe tool that turns color regions into editable vector shape groups.

### Pillow
`Image.quantize(colors=N, method=...)` (median-cut, max-coverage, or fast-octree) and `ImageOps.posterize(...)` produce the flat-region segmentation natively.
`ImageDraw.polygon(...)` renders the triangles or rectangles once their coordinates are known, so Pillow is the drawing surface for the primitive-fitting family.
The geometry itself needs companions: `scipy.spatial.Delaunay` over edge-weighted sample points for low-poly triangulation, or `skimage.segmentation.slic` for superpixel regions.

### Named mechanical references
Low-poly generation is well documented: detect feature points (Sobel/Harris), sample points with density proportional to local edge energy, Delaunay-triangulate them, then fill each triangle with its mean color.
Michael Fogleman's *Primitive* is the canonical "master copy in shapes" algorithm: it approximates a target image with a fixed number of triangles, rectangles, or ellipses via hill-climbing to minimize pixel difference — fully mechanical and directly on-theme.
SLIC superpixels (Achanta et al.) give perceptually uniform region groups when polygonal cells rather than triangles are preferred.

---

## Filter 3 — Human-figure construction (Loomis / Bridgman)

### Target
The figure reduced to a hierarchy of simple volumes — an ovoid ribcage, a boxy pelvis, cylindrical limbs, ball joints — plus the gesture and rhythm lines Bridgman emphasized, all measured from the actual pose in the image.

### The mechanical pipeline
The Loomis/Bridgman method is a mapping from body structure to primitive volumes, so the filter first needs the body's structure recovered from the pixels.
Pose estimation supplies it: MediaPipe Pose returns 33 body landmarks and OpenPose returns a 25-point body skeleton, both localized from the real image.
From those joints the construction is deterministic: place spheres at the joints, tapered cylinders (capsules) between them, an ovoid fitted to the shoulder-and-hip landmark quad for the ribcage, and a box for the pelvis, every proportion scaled by the measured segment lengths so the mannequin matches the subject.
DensePose (Facebook AI Research) goes further by assigning every figure pixel a coordinate on a canonical 3D body surface, which lets simplified body-part regions be projected back faithfully.

### The no-neural-network fallback
Threshold the figure to a silhouette, skeletonize it with the medial-axis transform to get the gesture line, and read limb thickness from the distance transform along that skeleton.
This is purely classical (scikit-image `skeletonize` and `medial_axis`) and needs no learned model, but it is far less robust to occlusion, foreshortening, and busy backgrounds, and it cannot name anatomical parts.

### Tool division
Photoshop has no native anatomy detection and is not the right tool here; Puppet Warp onto a template is manual posing, not derivation from the image.
Pillow is the rendering surface — `ImageDraw` ellipses, tapered polygons, and rhythm lines — driven by geometry that must come from MediaPipe, OpenPose, DensePose, or the scikit-image skeleton route.

### Honesty on the "not AI" constraint
Pose and body-surface models are neural networks, but they *measure* the real image and emit coordinates; the mannequin drawn from those coordinates is deterministic geometry, not a generated image, so it satisfies "computed from the image, not re-rendered."
If the constraint is read strictly as "no neural networks at all," only the silhouette/medial-axis fallback qualifies, and the section above is explicit that its fidelity is materially lower.

---

## Filter 4 — Hand construction

### Target
The same volume-and-gesture reduction as filter 3, specialized to the hand: the wedge-shaped palm block, the cylindrical phalanges, the knuckle arcs, and the opposed plane of the thumb, all measured from the actual hand in the image.

### The mechanical pipeline
MediaPipe Hands is the standout tool: it returns 21 landmarks per hand — the wrist plus four points (MCP, PIP, DIP, TIP) for each finger — localized from the real pixels.
From those 21 points the Bridgman/Loomis hand is constructed deterministically: a quadrilateral or wedge for the palm block from the wrist and the five MCP knuckles, chains of tapered cylinders for the fingers between successive phalange landmarks, an arc through the MCP and PIP points for each knuckle line, and a separate opposed plane for the thumb chain.
Because every element is placed from measured landmark positions, the drawing stays faithful to the specific hand's proportions and pose.

### The no-neural-network fallback
Segment the hand by skin color in HSV or YCrCb, extract the contour, then compute the convex hull and its convexity defects (OpenCV `convexHull` and `convexityDefects`): hull vertices approximate fingertips and the deep defect points approximate the valleys between fingers.
This is a documented classical hand-analysis technique that needs no learned model, but it degrades with skin-tone variation, occlusion, and non-splayed poses.

### Tool division and the "not AI" note
Photoshop has nothing native for this; Pillow is again the renderer for the landmark-derived construction.
The same honesty note as filter 3 applies: MediaPipe Hands is a neural detector that measures the image and outputs coordinates, and the drawn hand is deterministic geometry from those coordinates, so it remains a computed transformation rather than a generated interpretation.

---

## Dependency summary

| Filter | Photoshop native? | Pillow native? | Companion libraries | Purely mechanical? |
| --- | --- | --- | --- | --- |
| 1 — Line drawing | Yes (Find Edges, Threshold, Photocopy) | Mostly (FIND_EDGES, DoG, threshold) | OpenCV / scikit-image for clean Canny | Yes |
| 2 — Geometric forms | Partly (Cutout, Crystallize, Mosaic) | Regions yes; triangulation no | scipy (Delaunay), scikit-image (SLIC), Fogleman *Primitive* | Yes |
| 3 — Figure construction | No | Rendering only | MediaPipe / OpenPose / DensePose; scikit-image for no-ML route | Detection is learned; output is computed geometry |
| 4 — Hand construction | No | Rendering only | MediaPipe Hands; OpenCV for no-ML convexity route | Detection is learned; output is computed geometry |

Filters 1 and 2 are fully classical and could ship with Pillow plus at most one CV companion.
Filters 3 and 4 depend on a keypoint detector for robustness, with a weaker classical fallback available if a strict no-neural-network policy is required.
