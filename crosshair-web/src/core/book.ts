/**
 * Book assembly: from an ordered list of images and print settings to a leaf
 * sequence. A leaf is one logical book page face; it never knows how it
 * reaches paper — that is the imposition layer's business.
 *
 * Ported from crosshair_print/leaves.py and book.py, with one sizing change:
 * instead of the CLI's exact-physical-height contract, images are scaled to
 * fit the content box (page minus margins), which is the webapp's model.
 */

import type { EffectKind } from "./effects";
import type { Rect } from "./effects";

export type Role = "recto" | "verso";

export interface PageGeometry {
  /** Leaf size in points (half the folded sheet). */
  width: number;
  height: number;
  /** Spine-side margin. */
  gutter: number;
  /** Outer three margins. */
  margin: number;
}

/** The rectangle a leaf may draw in; the gutter hugs the spine side. */
export function contentBox(geometry: PageGeometry, role: Role): Rect {
  const left = role === "recto" ? geometry.gutter : geometry.margin;
  const right = role === "recto" ? geometry.margin : geometry.gutter;
  return {
    x: left,
    y: geometry.margin,
    w: geometry.width - left - right,
    h: geometry.height - 2 * geometry.margin,
  };
}

export interface Leaf {
  kind: "image" | "companion" | "title" | "blank";
  role: Role;
  /** Index into the book's image list (image and companion leaves). */
  imageIndex?: number;
  /** Printed image size in points; the companion shares it so guides mirror exactly. */
  contentSize?: { w: number; h: number };
  effect?: EffectKind;
  titleLines?: string[];
}

/**
 * The image/effect rectangle: contentSize centered in the content box.
 * Because recto and verso boxes mirror across the spine and the rect is
 * centered in its box, an image leaf's rect and its companion's rect are
 * automatically mirror images across the spine.
 */
export function leafContentRect(leaf: Leaf, geometry: PageGeometry): Rect | null {
  if (!leaf.contentSize) return null;
  const box = contentBox(geometry, leaf.role);
  return {
    x: box.x + (box.w - leaf.contentSize.w) / 2,
    y: box.y + (box.h - leaf.contentSize.h) / 2,
    w: leaf.contentSize.w,
    h: leaf.contentSize.h,
  };
}

/** Scale-to-fit (contain) of an aspect ratio inside a box. */
export function fitContain(
  imageW: number,
  imageH: number,
  boxW: number,
  boxH: number,
): { w: number; h: number } {
  const scale = Math.min(boxW / imageW, boxH / imageH);
  return { w: imageW * scale, h: imageH * scale };
}

export interface BookImage {
  /** Source pixel dimensions; only the aspect ratio matters here. */
  width: number;
  height: number;
  effect: EffectKind;
}

export interface BookOptions {
  geometry: PageGeometry;
  /** Draw a formatted blank facing each image for copying against. */
  facingPages: boolean;
  /** Which side of the spread the image takes. */
  imageSide: "left" | "right";
  titleLines: string[];
}

/**
 * Leaf faces in reading order. Face 0 is the cover (recto); faces (1,2),
 * (3,4), … are spreads, so with the cover in front every image+companion
 * pair lands on a single spread. Roles alternate: even index recto, odd verso.
 */
export function assembleBook(images: BookImage[], options: BookOptions): Leaf[] {
  const leaves: Leaf[] = [];
  const push = (leaf: Omit<Leaf, "role">) => {
    leaves.push({ ...leaf, role: leaves.length % 2 === 0 ? "recto" : "verso" });
  };

  push({ kind: "title", titleLines: options.titleLines });

  images.forEach((image, index) => {
    // Fit against the verso box; recto and verso boxes are the same size,
    // just mirrored, so the fitted size is identical for both roles.
    const box = contentBox(options.geometry, "verso");
    const size = fitContain(image.width, image.height, box.w, box.h);
    const imageLeaf: Omit<Leaf, "role"> = {
      kind: "image",
      imageIndex: index,
      contentSize: size,
      effect: image.effect,
    };
    const companionLeaf: Omit<Leaf, "role"> = {
      kind: "companion",
      imageIndex: index,
      contentSize: size,
      effect: image.effect,
    };
    if (!options.facingPages) {
      push(imageLeaf);
      return;
    }
    // Spreads read (verso, recto) = (left, right).
    if (options.imageSide === "left") {
      push(imageLeaf);
      push(companionLeaf);
    } else {
      push(companionLeaf);
      push(imageLeaf);
    }
  });

  return leaves;
}
