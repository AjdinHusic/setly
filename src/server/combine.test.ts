import { describe, expect, it } from "vitest";
import { deepMergeConfig } from "./combine.js";
import { generateParameters } from "./describe.js";

describe("deepMergeConfig", () => {
  it("merges nested objects with overlay winning", () => {
    expect(
      deepMergeConfig(
        { Host: { Name: "base", Port: 1 }, Flag: false },
        { Host: { Port: 99 }, Flag: true },
      ),
    ).toEqual({ Host: { Name: "base", Port: 99 }, Flag: true });
  });

  it("replaces arrays wholesale", () => {
    expect(
      deepMergeConfig(
        { List: ["a", "b"] },
        { List: ["x"] },
      ),
    ).toEqual({ List: ["x"] });
  });

  it("adds new keys from overlay", () => {
    expect(deepMergeConfig({ A: 1 }, { B: 2 })).toEqual({ A: 1, B: 2 });
  });
});

describe("list type inference", () => {
  it("infers list<string> / list<number> / list<boolean>", () => {
    const params = generateParameters({
      Origins: ["a", "b"],
      Ports: [1, 2],
      Flags: [true, false],
      Mixed: [1, "x"],
    });
    expect(params.Origins).toMatchObject({
      Type: "list",
      ItemType: "string",
      InitialValue: ["a", "b"],
    });
    expect(params.Ports).toMatchObject({ Type: "list", ItemType: "number" });
    expect(params.Flags).toMatchObject({ Type: "list", ItemType: "boolean" });
    expect(params.Mixed).toMatchObject({ Type: "json" });
  });
});
