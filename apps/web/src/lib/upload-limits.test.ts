import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES, uploadProblem } from "./upload-limits";

const MB = 1024 * 1024;

describe("uploadProblem", () => {
  it("allows files within both limits", () => {
    expect(uploadProblem([{ name: "a.pdf", size: 9 * MB }])).toBeNull();
    expect(uploadProblem([])).toBeNull();
  });
  it("names an oversize file and its size", () => {
    const msg = uploadProblem([{ name: "big.pdf", size: 12.3 * MB }]);
    expect(msg).toContain("big.pdf");
    expect(msg).toContain("12.3 MB");
    expect(msg).toContain("10 MB limit");
  });
  it("catches a batch that fits per file but not together", () => {
    const files = [1, 2, 3].map((i) => ({ name: `f${i}.pdf`, size: 6 * MB }));
    expect(uploadProblem(files)).toMatch(/smaller groups/);
  });
  it("treats exactly the limit as fine", () => {
    expect(uploadProblem([{ name: "a.pdf", size: MAX_UPLOAD_BYTES }])).toBeNull();
    expect(MAX_REQUEST_BYTES).toBeGreaterThan(MAX_UPLOAD_BYTES);
  });
});
