"use strict";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif",
  "tif", "tiff", "ico", "heic", "heif"
]);
const MIME_EXTENSIONS = {
  "image/png": "png", "image/x-png": "png", "image/jpeg": "jpg",
  "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp",
  "image/svg+xml": "svg", "image/avif": "avif", "image/tiff": "tif",
  "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
  "image/heic": "heic", "image/heif": "heif"
};
const UNSAFE_CHARS = /[<>:"/\\|?*\[\]#^\x00-\x1f\x7f]/u;
const RESERVED_STEM = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

function imageExtension(file) {
  const mime = String(file.type || "").toLowerCase().split(";")[0];
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  if (mime && !mime.startsWith("image/") && mime !== "application/octet-stream") return null;
  const match = /\.([^.]+)$/.exec(file.name || "");
  const ext = match && match[1].toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : null;
}

function validateStem(input, extension) {
  let stem = String(input || "").normalize("NFC").trim();
  const suffix = "." + extension;
  if (stem.toLowerCase().endsWith(suffix.toLowerCase())) {
    stem = stem.slice(0, -suffix.length);
  } else {
    const typedExtension = /\.([^.]+)$/.exec(stem);
    if (typedExtension && IMAGE_EXTENSIONS.has(typedExtension[1].toLowerCase())) {
      throw new Error("图片格式保持为 ." + extension + "，请只输入名称，不要修改扩展名。");
    }
  }
  if (!stem || stem === "." || stem === "..") throw new Error("请输入图片名称。");
  if (UNSAFE_CHARS.test(stem)) throw new Error('名称不能包含路径或链接字符：/ \\ : * ? " < > | [ ] # ^');
  if (/[. ]$/.test(stem)) throw new Error("名称不能以句点或空格结尾。");
  if (RESERVED_STEM.test(stem)) throw new Error("这是 Windows 保留名称，请换一个名称。");
  if (Array.from(stem).length > 150) throw new Error("名称过长，请控制在 150 个字符以内。");
  return stem;
}

function safeNoteStem(name) {
  let stem = String(name || "").normalize("NFC")
    .replace(/[<>:"/\\|?*\[\]#^\x00-\x1f\x7f]/gu, "-")
    .trim().replace(/[. ]+$/u, "");
  if (!stem) stem = "未命名笔记";
  if (RESERVED_STEM.test(stem)) stem = "笔记-" + stem;
  return Array.from(stem).slice(0, 100).join("");
}

function withNotePrefix(stem, noteName, includeNoteName) {
  if (!includeNoteName) return stem;
  const note = safeNoteStem(noteName);
  const lower = stem.toLocaleLowerCase();
  if (lower === note.toLocaleLowerCase() || lower.startsWith((note + "-").toLocaleLowerCase())) return stem;
  return note + "-" + stem;
}

function uniqueName(stem, extension, existingNames, alwaysNumber = false) {
  const existing = new Set(existingNames.map(name => name.normalize("NFC").toLocaleLowerCase()));
  const base = stem + "." + extension;
  if (!alwaysNumber && !existing.has(base.toLocaleLowerCase())) return base;
  for (let number = 1; number <= 100000; number++) {
    const candidate = stem + "-" + number + "." + extension;
    if (!existing.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error("同名图片过多，请换一个名称。");
}

module.exports = { imageExtension, validateStem, safeNoteStem, withNotePrefix, uniqueName };
