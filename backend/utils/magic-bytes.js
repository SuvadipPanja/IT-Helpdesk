/**
 * Magic byte validation for uploaded files.
 * Checks the first bytes of a file to verify it matches the claimed extension,
 * preventing attackers from uploading disguised executables or scripts.
 */
const fs = require('fs');

// Magic byte signatures mapped to allowed extensions
const SIGNATURES = [
  { magic: Buffer.from([0x25, 0x50, 0x44, 0x46]),           offset: 0, exts: ['.pdf'] },
  { magic: Buffer.from([0xFF, 0xD8, 0xFF]),                  offset: 0, exts: ['.jpg', '.jpeg'] },
  { magic: Buffer.from([0x89, 0x50, 0x4E, 0x47]),            offset: 0, exts: ['.png'] },
  { magic: Buffer.from('GIF87a'),                             offset: 0, exts: ['.gif'] },
  { magic: Buffer.from('GIF89a'),                             offset: 0, exts: ['.gif'] },
  { magic: Buffer.from([0x42, 0x4D]),                         offset: 0, exts: ['.bmp'] },
  // ZIP-based formats: .zip, .docx, .xlsx, .pptx
  { magic: Buffer.from([0x50, 0x4B, 0x03, 0x04]),            offset: 0, exts: ['.zip', '.docx', '.xlsx', '.pptx'] },
  // OLE2 Compound Document: .doc, .xls, .ppt
  { magic: Buffer.from([0xD0, 0xCF, 0x11, 0xE0]),            offset: 0, exts: ['.doc', '.xls', '.ppt'] },
  // RAR
  { magic: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]), offset: 0, exts: ['.rar'] },
  // 7z
  { magic: Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]), offset: 0, exts: ['.7z'] },
];

// WEBP has RIFF header with WEBP at offset 8
const WEBP_RIFF = Buffer.from('RIFF');
const WEBP_MARKER = Buffer.from('WEBP');

// Extensions that are text-based (no binary magic bytes to check)
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.svg']);

/**
 * Validate that a file's magic bytes match its claimed extension.
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} ext - The claimed file extension (e.g. '.pdf')
 * @returns {boolean} true if the file passes validation
 */
function validateMagicBytes(filePath, ext) {
  const normalizedExt = ext.toLowerCase();

  // Text-based files don't have reliable magic bytes
  if (TEXT_EXTENSIONS.has(normalizedExt)) {
    return true;
  }

  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);

    // Special case: WEBP (RIFF....WEBP)
    if (normalizedExt === '.webp') {
      return header.subarray(0, 4).equals(WEBP_RIFF) &&
             header.subarray(8, 12).equals(WEBP_MARKER);
    }

    // Check against known signatures
    for (const sig of SIGNATURES) {
      if (!sig.exts.includes(normalizedExt)) continue;
      const slice = header.subarray(sig.offset, sig.offset + sig.magic.length);
      if (slice.equals(sig.magic)) {
        return true;
      }
    }

    return false;
  } catch {
    // If we can't read the file, fail closed (reject)
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { validateMagicBytes };
