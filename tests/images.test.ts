import { describe, expect, it } from "vitest";
import { imageUrlWarning, normalizeImageUrl } from "@/lib/images";

describe("normalizeImageUrl", () => {
  it("turns a Google Drive share link into something that actually renders", () => {
    expect(normalizeImageUrl("https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing"))
      .toBe("https://drive.google.com/uc?export=view&id=1AbC_dEf-123");
  });

  it("handles the older Drive open?id= form", () => {
    expect(normalizeImageUrl("https://drive.google.com/open?id=1AbC_dEf-123"))
      .toBe("https://drive.google.com/uc?export=view&id=1AbC_dEf-123");
  });

  it("asks Dropbox for the file rather than the page", () => {
    expect(normalizeImageUrl("https://www.dropbox.com/s/abc/photo.jpg?dl=0"))
      .toBe("https://www.dropbox.com/s/abc/photo.jpg?raw=1");
    expect(normalizeImageUrl("https://www.dropbox.com/s/abc/photo.jpg"))
      .toBe("https://www.dropbox.com/s/abc/photo.jpg?raw=1");
  });

  it("leaves a direct image address alone", () => {
    const url = "https://images.example.com/wedding/haldi.jpg";
    expect(normalizeImageUrl(url)).toBe(url);
  });

  it("leaves an uploaded path alone", () => {
    expect(normalizeImageUrl("/uploads/abc.jpg")).toBe("/uploads/abc.jpg");
  });

  it("trims, so a copy-paste with whitespace still works", () => {
    expect(normalizeImageUrl("  https://a.com/b.jpg  ")).toBe("https://a.com/b.jpg");
  });

  it("is empty-safe", () => {
    expect(normalizeImageUrl("")).toBe("");
    expect(normalizeImageUrl("   ")).toBe("");
  });
});

describe("imageUrlWarning", () => {
  it("cautions that Google Drive links usually will not render", () => {
    expect(imageUrlWarning("https://drive.google.com/uc?export=view&id=abc")).toMatch(/Anyone with the link/);
  });

  it("says nothing about a normal image address", () => {
    expect(imageUrlWarning("https://images.example.com/a.jpg")).toBeNull();
    expect(imageUrlWarning("/uploads/a.jpg")).toBeNull();
    expect(imageUrlWarning("")).toBeNull();
  });

  it("explains why an Instagram link will not work", () => {
    expect(imageUrlWarning("https://www.instagram.com/p/ABC123/")).toMatch(/Instagram/);
  });

  it("catches a Google image search link", () => {
    expect(imageUrlWarning("https://www.google.com/search?q=wedding&tbm=isch")).toMatch(/search link/);
  });

  it("catches a Google Photos share link", () => {
    expect(imageUrlWarning("https://photos.google.com/share/AF1Qip")).toMatch(/Google Photos/);
  });

  it("catches something that is not a web address at all", () => {
    expect(imageUrlWarning("C:\\Users\\User\\Pictures\\a.jpg")).toMatch(/web address/);
  });
});
