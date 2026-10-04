import { describe, expect, it } from "vitest";
import {
  acceptSupportFiles,
  checkPickedFiles,
  cleanFilename,
  MAX_SUPPORT_FILE_BYTES,
  MAX_SUPPORT_FILES,
  neutralFilename,
  sniffSupportType,
} from "./support-attachments";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const HTML = Array.from(new TextEncoder().encode("<script>alert(1)</script>"));

const file = (bytes: number[], name: string, type = "") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("sniffSupportType", () => {
  it("recognises the allowed kinds from their bytes", () => {
    expect(sniffSupportType(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffSupportType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffSupportType(new Uint8Array(PDF))).toBe("application/pdf");
    expect(sniffSupportType(new Uint8Array(WEBP))).toBe("image/webp");
  });

  it("rejects anything else, whatever it is named", () => {
    expect(sniffSupportType(new Uint8Array(HTML))).toBeNull();
    expect(sniffSupportType(new Uint8Array([]))).toBeNull();
    // RIFF but not WEBP (a WAV, say)
    expect(
      sniffSupportType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41])),
    ).toBeNull();
  });
});

describe("acceptSupportFiles", () => {
  it("keeps real images and PDFs and reports the type from the bytes", async () => {
    const { accepted, rejected } = await acceptSupportFiles([
      file(PNG, "shot.png", "image/png"),
      file(PDF, "invoice.pdf", "application/pdf"),
    ]);
    expect(accepted.map((a) => a.contentType)).toEqual(["image/png", "application/pdf"]);
    expect(rejected).toEqual([]);
  });

  it("drops a script renamed to .png even when the browser claims image/png", async () => {
    const { accepted, rejected } = await acceptSupportFiles([file(HTML, "evil.png", "image/png")]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual(["evil.png"]);
  });

  it("ignores the empty part a form sends when no file was chosen", async () => {
    const { accepted, rejected } = await acceptSupportFiles([file([], "", "")]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("ignores plain text values in the files field", async () => {
    expect((await acceptSupportFiles(["not a file"])).accepted).toEqual([]);
  });

  it("keeps at most the limit and names the rest", async () => {
    const many = Array.from({ length: MAX_SUPPORT_FILES + 2 }, (_, i) => file(PNG, `s${i}.png`));
    const { accepted, rejected } = await acceptSupportFiles(many);
    expect(accepted).toHaveLength(MAX_SUPPORT_FILES);
    expect(rejected).toEqual(["s3.png", "s4.png"]);
  });

  it("drops a file over the size limit", async () => {
    const big = file([...PNG, ...new Array(MAX_SUPPORT_FILE_BYTES)].map(Number), "huge.png");
    const { accepted, rejected } = await acceptSupportFiles([big]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual(["huge.png"]);
  });
});

describe("checkPickedFiles", () => {
  it("accepts a normal pick", () => {
    expect(checkPickedFiles([{ name: "a.png", size: 1000, type: "image/png" }])).toEqual({
      ok: true,
    });
  });
  it("names the file that is too big", () => {
    const r = checkPickedFiles([
      { name: "a.png", size: MAX_SUPPORT_FILE_BYTES + 1, type: "image/png" },
    ]);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("a.png");
  });
  it("rejects too many and the wrong kind", () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      name: `${i}.png`,
      size: 1,
      type: "image/png",
    }));
    expect(checkPickedFiles(four).ok).toBe(false);
    expect(checkPickedFiles([{ name: "x.zip", size: 1, type: "application/zip" }]).ok).toBe(false);
  });
});

describe("cleanFilename", () => {
  it("strips paths and header-breaking characters", () => {
    expect(cleanFilename("../../etc/pass wd.png")).toBe("pass wd.png");
    expect(cleanFilename('a"b\r\nc.png')).toBe("a_b__c.png");
    expect(cleanFilename("")).toBe("attachment");
  });
});

describe("neutralFilename", () => {
  it("replaces the operator's own file name with a plain numbered one", () => {
    expect(neutralFilename("image/png", 0)).toBe("Screenshot 1.png");
    expect(neutralFilename("image/jpeg", 1)).toBe("Screenshot 2.jpg");
    expect(neutralFilename("image/webp", 2)).toBe("Screenshot 3.webp");
    expect(neutralFilename("application/pdf", 0)).toBe("Attachment 1.pdf");
  });
});
