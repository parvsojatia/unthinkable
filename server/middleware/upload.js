import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.resolve(__dirname, '..', '..', 'uploads');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Storage: save to disk with unique filename ───────────

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (_req, file, cb) => {
        const requestId = randomUUID();
        const ext = path.extname(file.originalname);
        const safeFilename = `${requestId}${ext}`;
        // Attach the requestId onto the file object so the route can read it
        file.requestId = requestId;
        cb(null, safeFilename);
    },
});

const fileFilter = (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(`Unsupported file type: ${file.mimetype}. Please upload a PDF, PNG, or JPG.`),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE },
});

/**
 * Clean up a temp file after processing.
 * @param {string} filepath - Absolute path to the temp file
 */
export function cleanupTempFile(filepath) {
    try {
        if (filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch {
        // Swallow — cleanup is best-effort
    }
}

export default upload;
