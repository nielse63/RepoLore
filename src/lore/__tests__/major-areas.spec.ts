import { majorAreasOf } from "../major-areas";
import type { StructuralArea } from "../model";

const area = (name: string) => ({ name }) as StructuralArea;

describe("majorAreasOf", () => {
  it("drops only the root directory area", () => {
    expect(
      majorAreasOf([area("src"), area("."), area("lib")]).map((a) => a.name)
    ).toEqual(["src", "lib"]);
  });

  it("is empty when the root area is the only one", () => {
    expect(majorAreasOf([area(".")])).toEqual([]);
  });
});
