import { describe, expect, it } from "vitest";
import {
  buildAppsettingsFromValues,
  describeHasFlatSeparatorKeys,
  expandFlatDescribeParameters,
  flattenParameters,
  generateDescribe,
  generateParameters,
  mergeDescribe,
  rebuildParametersPreservingMeta,
  valuesFromAppsettings,
} from "./describe.js";
import type { DescribeConfig, FieldMeta } from "./types.js";

function field(
  partial: Partial<FieldMeta> & Pick<FieldMeta, "InitialValue" | "Label">,
): FieldMeta {
  return {
    Type: "string",
    Description: "",
    Required: false,
    ...partial,
  };
}

describe("generateParameters / generateDescribe", () => {
  it("builds nested FieldMeta leaves from objects", () => {
    const params = generateParameters({
      Host: { Name: "app", Port: 80 },
      Flag: true,
    });
    expect(params.Flag).toMatchObject({
      Type: "boolean",
      InitialValue: true,
      Label: "Flag",
    });
    expect(
      (params.Host as Record<string, FieldMeta>).Name,
    ).toMatchObject({
      Type: "string",
      InitialValue: "app",
      Label: "Name",
    });
    expect(
      (params.Host as Record<string, FieldMeta>).Port,
    ).toMatchObject({
      Type: "number",
      InitialValue: 80,
    });
  });

  it("stores Separator on generateDescribe when provided", () => {
    const d = generateDescribe({ A: 1 }, ".env", { separator: "_" });
    expect(d.Separator).toBe("_");
    expect(d.TargetFile).toBe(".env");
  });
});

describe("flattenParameters", () => {
  it("returns dotted paths for nested leaves", () => {
    const fields = flattenParameters(
      generateParameters({ A: { B: "x" }, C: 1 }),
    );
    expect(fields.map((f) => f.path.join("."))).toEqual(["A.B", "C"]);
  });
});

describe("mergeDescribe", () => {
  it("keeps existing metadata and marks missing keys stale", () => {
    const existing: DescribeConfig = {
      TargetFile: "appsettings.json",
      Parameters: {
        Keep: field({
          InitialValue: "old",
          Label: "Keep label",
          Description: "desc",
          Required: true,
        }),
        Gone: field({ InitialValue: "x", Label: "Gone" }),
      },
    };
    const { describe, stalePaths } = mergeDescribe(
      existing,
      { Keep: "live", New: 2 },
      "appsettings.json",
    );
    expect(stalePaths).toContain("Gone");
    const keep = describe.Parameters.Keep as FieldMeta;
    expect(keep.Label).toBe("Keep label");
    expect(keep.Description).toBe("desc");
    expect(keep.Required).toBe(true);
    expect(keep.InitialValue).toBe("old");
    expect(describe.Parameters.New).toMatchObject({
      Type: "number",
      InitialValue: 2,
    });
  });

  it("preserves Separator from existing", () => {
    const existing: DescribeConfig = {
      TargetFile: ".env",
      Separator: "__",
      Parameters: { A: field({ InitialValue: "1", Label: "A" }) },
    };
    const { describe } = mergeDescribe(existing, { A: "1" }, ".env");
    expect(describe.Separator).toBe("__");
  });
});

describe("expandFlatDescribeParameters", () => {
  it("detects flat separator keys", () => {
    expect(
      describeHasFlatSeparatorKeys(
        { HOST_NAME: field({ InitialValue: "x", Label: "Host" }) },
        "_",
      ),
    ).toBe(true);
    expect(
      describeHasFlatSeparatorKeys(
        { HOST: { NAME: field({ InitialValue: "x", Label: "Host" }) } },
        "_",
      ),
    ).toBe(false);
  });

  it("expands HOST_NAME into HOST.NAME while keeping meta", () => {
    const expanded = expandFlatDescribeParameters(
      {
        HOST_NAME: field({
          InitialValue: "app",
          Label: "Host name",
          Required: true,
          Description: "d",
        }),
        SIMPLE: field({ InitialValue: "s", Label: "Simple" }),
      },
      "_",
    );
    expect(
      (expanded.HOST as Record<string, FieldMeta>).NAME,
    ).toMatchObject({
      Label: "Host name",
      Required: true,
      Description: "d",
      InitialValue: "app",
    });
    expect(expanded.SIMPLE).toMatchObject({ Label: "Simple" });
  });
});

describe("rebuildParametersPreservingMeta", () => {
  it("maps meta across separator changes via env key", () => {
    const previous = {
      HOST: {
        NAME: field({
          InitialValue: "app",
          Label: "Host name",
          Required: true,
        }),
      },
    };
    const nested = { HOST: { NAME: "app", PORT: "80" } };
    const rebuilt = rebuildParametersPreservingMeta(
      nested,
      previous,
      "_",
      "_",
    );
    expect(
      (rebuilt.HOST as Record<string, FieldMeta>).NAME,
    ).toMatchObject({
      Label: "Host name",
      Required: true,
    });
    expect(
      (rebuilt.HOST as Record<string, FieldMeta>).PORT,
    ).toMatchObject({
      InitialValue: "80",
    });
  });
});

describe("buildAppsettingsFromValues / valuesFromAppsettings", () => {
  const describeCfg: DescribeConfig = {
    TargetFile: "appsettings.json",
    Parameters: generateParameters({
      Host: { Name: "default", Port: 1 },
      Flag: false,
    }),
  };

  it("builds nested object from dotted values", () => {
    const obj = buildAppsettingsFromValues(describeCfg, {
      "Host.Name": "live",
      "Host.Port": 99,
      Flag: true,
    });
    expect(obj).toEqual({
      Host: { Name: "live", Port: 99 },
      Flag: true,
    });
  });

  it("falls back to InitialValue when value missing", () => {
    const obj = buildAppsettingsFromValues(describeCfg, {});
    expect(obj).toEqual({
      Host: { Name: "default", Port: 1 },
      Flag: false,
    });
  });

  it("reads values from nested appsettings", () => {
    const values = valuesFromAppsettings(describeCfg, {
      Host: { Name: "from-file", Port: 7 },
      Flag: true,
    });
    expect(values).toEqual({
      "Host.Name": "from-file",
      "Host.Port": 7,
      Flag: true,
    });
  });

  it("coerces number and boolean from strings", () => {
    const obj = buildAppsettingsFromValues(describeCfg, {
      "Host.Name": "x",
      "Host.Port": "42",
      Flag: "true",
    });
    expect(obj).toEqual({
      Host: { Name: "x", Port: 42 },
      Flag: true,
    });
  });
});
