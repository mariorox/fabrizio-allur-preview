import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export const UPLOAD_SUBDIRS = {
  fabrics: 'fabrics',
  clientPhotos: 'client-photos',
  results: 'results',
} as const;

export function ensureUploadDirs() {
  for (const sub of Object.values(UPLOAD_SUBDIRS)) {
    const dir = path.join(UPLOADS_DIR, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/** Save a Buffer to uploads/<subdir>/<filename> and return the relative path */
export function saveUploadedFile(
  buffer: Buffer,
  subdir: string,
  filename: string
): string {
  ensureUploadDirs();
  const dir = path.join(UPLOADS_DIR, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `${subdir}/${filename}`;
}

/** Save to a nested subdir (e.g. client-photos/<sessionId>/<filename>) */
export function saveSessionPhoto(
  buffer: Buffer,
  sessionId: string,
  filename: string
): string {
  ensureUploadDirs();
  const dir = path.join(UPLOADS_DIR, UPLOAD_SUBDIRS.clientPhotos, sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `${UPLOAD_SUBDIRS.clientPhotos}/${sessionId}/${filename}`;
}

/** Get the absolute filesystem path for a relative upload path */
export function getAbsolutePath(relativePath: string): string {
  return path.join(UPLOADS_DIR, relativePath);
}

/** Get the URL to serve a file via the /api/files route */
export function getFileUrl(relativePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${baseUrl}/api/files/${relativePath}`;
}

/** Read a file as Buffer */
export function readFile(relativePath: string): Buffer {
  return fs.readFileSync(getAbsolutePath(relativePath));
}

/** Check if a file exists */
export function fileExists(relativePath: string): boolean {
  return fs.existsSync(getAbsolutePath(relativePath));
}
