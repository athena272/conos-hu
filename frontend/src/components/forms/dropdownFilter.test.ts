import { describe, expect, it } from "vitest";
import { buildDropdownFilterProps } from "./dropdownFilter";

describe("buildDropdownFilterProps", () => {
  it("liga a busca com placeholder, id e rótulo acessível no campo interno", () => {
    expect(
      buildDropdownFilterProps({ id: "paciente-busca", placeholder: "Digite o nome do paciente" }),
    ).toEqual({
      filter: true,
      filterPlaceholder: "Digite o nome do paciente",
      pt: { filterInput: { id: "paciente-busca", "aria-label": "Digite o nome do paciente" } },
    });
  });
});
