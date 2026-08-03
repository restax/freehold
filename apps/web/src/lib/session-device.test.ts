import { describe, expect, it } from "vitest";
import { classifyDeviceType } from "./session-device";

describe("classifyDeviceType", () => {
  it("classifies common desktop UAs as desktop", () => {
    expect(
      classifyDeviceType(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      ),
    ).toBe("desktop");
    expect(
      classifyDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"),
    ).toBe("desktop");
  });

  it("classifies iPhone, iPad, and Android UAs as mobile", () => {
    expect(classifyDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      "mobile",
    );
    expect(classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(classifyDeviceType("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobi")).toBe("mobile");
  });

  it("defaults to desktop for missing or unrecognized UAs", () => {
    expect(classifyDeviceType(null)).toBe("desktop");
    expect(classifyDeviceType(undefined)).toBe("desktop");
    expect(classifyDeviceType("")).toBe("desktop");
    expect(classifyDeviceType("SomeUnknownBot/1.0")).toBe("desktop");
  });
});
