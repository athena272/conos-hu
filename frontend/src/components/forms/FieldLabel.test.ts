import { describe, expect, it } from "vitest";
import { requiredFieldMarker } from "./requiredFieldMarker";

describe("FieldLabel marker contract", () => {
  it("keeps the SOST-compatible required suffix for labels", () => {
    expect(requiredFieldMarker(true)).toBe(" (obrigatório)");
  });
});
