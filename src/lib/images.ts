/**
 * Share links from Drive, Dropbox and friends point at a viewer page, not the
 * image itself, so pasting one shows nothing and looks like a broken feature.
 * These are the conversions worth making automatically.
 */
export function normalizeImageUrl(input: string): string {
  const url = input.trim();
  if (!url) return "";

  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const drive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;

  // https://drive.google.com/open?id=FILE_ID
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/);
  if (driveOpen) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;

  // Dropbox share links serve an HTML page unless asked for the raw file.
  if (/dropbox\.com\//.test(url)) {
    return url.replace(/([?&])dl=0/, "$1raw=1").replace(/([?&])dl=1/, "$1raw=1")
      + (/[?&](raw|dl)=/.test(url) ? "" : (url.includes("?") ? "&raw=1" : "?raw=1"));
  }

  return url;
}

/** Links we know will not render, so the editor can say so before saving. */
export function imageUrlWarning(input: string): string | null {
  const url = input.trim();
  if (!url) return null;

  if (/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
    return "Instagram post links can't be shown directly. Open the photo, save it, and upload the file — or use a link that ends in .jpg.";
  }
  if (/^https?:\/\/(www\.)?(google\.[a-z.]+)\/(search|imgres)/i.test(url)) {
    return "That's a Google search link, not an image. Open the photo itself and copy its direct address.";
  }
  if (/^https?:\/\/photos\.(google|app\.goo)\./i.test(url)) {
    return "Google Photos share links can't be shown directly. Download the photo and upload the file instead.";
  }
  if (/drive\.google\.com/i.test(url)) {
    // Drive refuses to serve most files as images, whatever the URL form, so
    // this is a caution rather than a conversion promise.
    return "Google Drive only serves a photo if the file is shared with \u201cAnyone with the link\u201d, and often not even then. Uploading the file is far more reliable.";
  }
  if (!/^(https?:)?\/\//i.test(url) && !url.startsWith("/")) {
    return "That doesn't look like a web address. It should start with https://";
  }
  return null;
}
