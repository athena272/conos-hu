import { describe, expect, it } from "vitest";
import { requiredFieldMarker } from "./requiredFieldMarker";

describe("requiredFieldMarker", () => {
  it("returns the required suffix when required is true", () => {
    expect(requiredFieldMarker(true)).toBe(" (obrigatório)");
  });

  it("returns null when required is false or omitted", () => {
    expect(requiredFieldMarker(false)).toBeNull();
    expect(requiredFieldMarker()).toBeNull();
    expect(requiredFieldMarker(undefined)).toBeNull();
  });
});
