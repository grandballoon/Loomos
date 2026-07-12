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
 * Bytes ready for pdf-lib: PNG and JPEG pass through untouched; everything
 * else is re-encoded to PNG via canvas.
 */
export async function pdfImageBytes(
  source: SourceImage,
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" }> {
  const type = source.file.type;
  if (type === "image/jpeg") {
    return { bytes: new Uint8Array(await source.file.arrayBuffer()), format: "jpg" };
  }
  if (type === "image/png") {
    return { bytes: new Uint8Array(await source.file.arrayBuffer()), format: "png" };
  }
  const bitmap = await createImageBitmap(source.file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), format: "png" };
}
