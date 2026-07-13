/**
 * Image intake: turn dropped files or folders into decoded, naturally sorted
 * source images. Folder drops read the top level only (book per folder, as in
 * the CLI's discovery rules); hidden files and non-raster files are skipped.
 */

export interface SourceImage {
  id: string;
  name: string;
  /** Pixel dimensions of the decoded image. */
  width: number;
  height: number;
  /** Object URL for preview rendering; valid for the session. */
  url: string;
  file: File;
}

const RASTER_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "gif",
  "avif",
]);

export function isRasterFile(name: string): boolean {
  if (name.startsWith(".")) return false;
  const dot = name.lastIndexOf(".");
  return dot > 0 && RASTER_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** Case-insensitive natural sort: img2 before img10. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

let nextId = 1;

async function decode(file: File): Promise<SourceImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not decode ${file.name}`));
      el.src = url;
    });
    return {
      id: `img-${nextId++}`,
      name: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      url,
      file,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** Top-level files of a dropped directory entry; readEntries batches at ~100. */
async function directoryFiles(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];
  for (;;) {
    const batch = await readEntries(reader);
    if (batch.length === 0) break;
    for (const child of batch) {
      if (child.isFile) files.push(await entryFile(child as FileSystemFileEntry));
    }
  }
  return files;
}

export interface DropResult {
  images: SourceImage[];
  /** Names of files that were skipped or failed to decode, with reasons. */
  skipped: string[];
  /** Name of the dropped folder, if the drop was a single directory. */
  folderName?: string;
}

/** Collect raster images from a drop: plain files and/or folder top levels. */
export async function collectDrop(items: DataTransferItemList): Promise<DropResult> {
  const files: File[] = [];
  const skipped: string[] = [];
  let folderName: string | undefined;
  let directories = 0;

  // getAsEntry must be harvested synchronously before any await.
  const entries = Array.from(items)
    .filter((item) => item.kind === "file")
    .map((item) => ({ entry: item.webkitGetAsEntry(), file: item.getAsFile() }));

  for (const { entry, file } of entries) {
    if (entry?.isDirectory) {
      directories += 1;
      folderName = entry.name;
      files.push(...(await directoryFiles(entry as FileSystemDirectoryEntry)));
    } else if (file) {
      files.push(file);
    }
  }
  if (directories !== 1) folderName = undefined;

  const candidates = files
    .filter((file) => {
      if (isRasterFile(file.name)) return true;
      skipped.push(`${file.name} — not a supported image`);
      return false;
    })
    .sort((a, b) => naturalCompare(a.name, b.name));

  const images: SourceImage[] = [];
  for (const file of candidates) {
    try {
      images.push(await decode(file));
    } catch {
      skipped.push(`${file.name} — could not decode`);
    }
  }
  return { images, skipped, folderName };
}

/**
 * EXIF orientation (1–8) of a JPEG, or 1 when absent or unreadable. pdf-lib
 * embeds raw JPEG pixels and ignores EXIF, while the browser preview applies
 * it, so any value above 1 means the bytes must be re-encoded before
 * embedding or the PDF would not match the preview.
 */
function jpegExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1; // start of scan: no EXIF ahead
    const size = view.getUint16(offset + 2);
    if (size < 2) return 1;
    if (
      marker === 0xffe1 &&
      offset + 12 <= view.byteLength &&
      view.getUint32(offset + 4) === 0x45786966 && // "Exif"
      view.getUint16(offset + 8) === 0
    ) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949; // "II"
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    offset += 2 + size;
  }
  return 1;
}

/** Rasterize through a canvas, baking in EXIF orientation, and re-encode. */
async function reencode(file: File, mime: "image/png" | "image/jpeg"): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`${mime} encode failed`))), mime, 0.92),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Bytes ready for pdf-lib: upright PNG and JPEG pass through untouched;
 * EXIF-rotated JPEGs are re-encoded (still as JPEG) with the rotation baked
 * in, and everything else is re-encoded to PNG via canvas.
 */
export async function pdfImageBytes(
  source: SourceImage,
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" }> {
  const type = source.file.type;
  if (type === "image/jpeg") {
    const buffer = await source.file.arrayBuffer();
    if (jpegExifOrientation(buffer) === 1) {
      return { bytes: new Uint8Array(buffer), format: "jpg" };
    }
    return { bytes: await reencode(source.file, "image/jpeg"), format: "jpg" };
  }
  if (type === "image/png") {
    return { bytes: new Uint8Array(await source.file.arrayBuffer()), format: "png" };
  }
  return { bytes: await reencode(source.file, "image/png"), format: "png" };
}
