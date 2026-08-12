import { describe, expect, it } from "vitest";
import { twentyPhone, twentyPhoneShapes } from "./twenty-phone";

/**
 * Twenty validates the phone composite with libphonenumber and rejects the
 * entire create with INVALID_PHONE_NUMBER when it can't parse what it was
 * given. "682-465-7098" is what actually got refused in production while
 * other numbers in the same session went through, so these cases are the
 * formats a screenshot realistically produces, not invented ones.
 */
describe("twentyPhone", () => {
  it("reduces every US spelling to the same stored number", () => {
    for (const raw of [
      "916-555-0142",
      "(916) 555-0142",
      "916.555.0142",
      "9165550142",
      " 916 555 0142 ",
      "1-916-555-0142",
      "+1 (916) 555-0142",
    ]) {
      expect(twentyPhone(raw)).toBe("9165550142");
    }
  });

  it("keeps a non-US number in E.164, where nothing has to be inferred", () => {
    expect(twentyPhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("declines what it cannot place", () => {
    // Too short to be real, an extension we would mangle, and the empty
    // cases. Null means "save the contact without the phone".
    expect(twentyPhone("555-0142")).toBeNull();
    expect(twentyPhone("682-465-7098 ext 204")).toBeNull();
    expect(twentyPhone("")).toBeNull();
    expect(twentyPhone("   ")).toBeNull();
    expect(twentyPhone(null)).toBeNull();
    expect(twentyPhone(undefined)).toBeNull();
    expect(twentyPhone("call the office")).toBeNull();
  });
});

describe("twentyPhoneShapes", () => {
  it("leads with the split Twenty documents today", () => {
    expect(twentyPhoneShapes("682-465-7098")[0]).toEqual({
      primaryPhoneNumber: "6824657098",
      primaryPhoneCallingCode: "+1",
      primaryPhoneCountryCode: "US",
    });
  });

  it("offers the older field layout and a bare E.164 as fallbacks", () => {
    const shapes = twentyPhoneShapes("682-465-7098");
    expect(shapes).toHaveLength(3);
    // Older workspaces have no callingCode field and keep "+1" in countryCode.
    expect(shapes[1]).toEqual({
      primaryPhoneNumber: "6824657098",
      primaryPhoneCountryCode: "+1",
    });
    // The shape no version can misread.
    expect(shapes[2]).toEqual({ primaryPhoneNumber: "+16824657098" });
  });

  it("never leaves formatting in a number it hands over", () => {
    for (const raw of ["682-465-7098", "(916) 555-0142", "+44 20 7946 0958", "1 916 555 0142"]) {
      for (const shape of twentyPhoneShapes(raw)) {
        expect(shape.primaryPhoneNumber).toMatch(/^\+?\d+$/);
      }
    }
  });

  it("gives one unambiguous shape for a number that arrived international", () => {
    expect(twentyPhoneShapes("+44 20 7946 0958")).toEqual([
      { primaryPhoneNumber: "+442079460958" },
    ]);
  });

  it("returns nothing to try when the number is unusable", () => {
    // An empty list is what makes the caller save the person without a phone
    // instead of sending something Twenty will refuse.
    expect(twentyPhoneShapes("682-465-7098 ext 204")).toEqual([]);
    expect(twentyPhoneShapes(null)).toEqual([]);
    expect(twentyPhoneShapes("")).toEqual([]);
  });
});
