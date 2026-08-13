import { describe, expect, it } from "vitest";
import {
  countDescribeChanges,
  countValueChanges,
  displayFieldKey,
  parseEnvParameterKey,
  parseParameterPath,
  restructureDescribeForSeparator,
  valuesEqual,
} from "./util";
import type { DescribeConfig, FieldMeta } from "./api";

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

describe("displayFieldKey", () => {
  it("joins with dot by default", () => {
    expect(displayFieldKey(["Host", "Name"])).toBe("Host.Name");
  });

  it("joins with env separator when provided", () => {
    expect(displayFieldKey(["HOST", "NAME"], { separator: "_" })).toBe(
      "HOST_NAME",
    );
    expect(displayFieldKey(["Host", "Name"], { separator: "__" })).toBe(
      "Host__Name",
    );
  });

  it("falls back to dotted when separator null/empty", () => {
    expect(displayFieldKey(["A", "B"], { separator: null })).toBe("A.B");
    expect(displayFieldKey(["A", "B"], { separator: "" })).toBe("A.B");
  });
});

describe("parseParameterPath", () => {
  it("parses dotted paths", () => {
    expect(parseParameterPath("Host.Name")).toEqual(["Host", "Name"]);
  });

  it("rejects empty and invalid segments", () => {
    expect(() => parseParameterPath("")).toThrow(/required/i);
    expect(() => parseParameterPath("Host..Name")).toThrow(/empty/i);
    expect(() => parseParameterPath("Host.1bad")).toThrow(/segment/i);
  });
});

describe("parseEnvParameterKey", () => {
  it("splits KEY on separator into path segments", () => {
    expect(parseEnvParameterKey("HOST_NAME", "_")).toEqual(["HOST", "NAME"]);
    expect(parseEnvParameterKey("Host__Name", "__")).toEqual(["Host", "Name"]);
    expect(parseEnvParameterKey("a:b:c", ":")).toEqual(["a", "b", "c"]);
  });

  it("keeps single segment when separator not present", () => {
    expect(parseEnvParameterKey("HOST_NAME", "__")).toEqual(["HOST_NAME"]);
  });

  it("rejects empty or illegal keys", () => {
    expect(() => parseEnvParameterKey("", "_")).toThrow(/required/i);
    expect(() => parseEnvParameterKey("1BAD", "_")).toThrow(/Key must/i);
  });
});

describe("valuesEqual / change counters", () => {
  it("compares primitives and objects", () => {
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("counts value changes across keys", () => {
    expect(
      countValueChanges({ a: 1, b: 2 }, { a: 1, b: 3, c: 0 }),
    ).toBe(2);
  });

  it("counts describe meta and separator changes", () => {
    const base: DescribeConfig = {
      TargetFile: ".env",
      Separator: "_",
      Parameters: {
        A: field({ InitialValue: "1", Label: "A" }),
      },
    };
    const same = structuredClone(base);
    expect(countDescribeChanges(same, base)).toBe(0);

    const sepOnly = { ...base, Separator: "__" };
    expect(countDescribeChanges(sepOnly, base)).toBe(1);

    const metaChanged: DescribeConfig = {
      ...base,
      Parameters: {
        A: field({ InitialValue: "1", Label: "Renamed" }),
      },
    };
    expect(countDescribeChanges(metaChanged, base)).toBe(1);
  });
});

describe("restructureDescribeForSeparator", () => {
  it("re-nests describe and values when separator changes", () => {
    const describe: DescribeConfig = {
      TargetFile: ".env",
      Separator: "_",
      Parameters: {
        HOST: {
          NAME: field({
            InitialValue: "app",
            Label: "Host name",
            Required: true,
          }),
        },
      },
    };
    const flatSource = { HOST_NAME: "app", HOST_PORT: "80" };
    const result = restructureDescribeForSeparator(
      describe,
      { "HOST.NAME": "live" },
      flatSource,
      "_",
    );
    expect(result.describe.Separator).toBe("_");
    expect(result.values["HOST.NAME"]).toBe("live");
    expect(result.values["HOST.PORT"]).toBe("80");
    expect(
      (result.describe.Parameters.HOST as Record<string, FieldMeta>).NAME,
    ).toMatchObject({ Label: "Host name", Required: true });
  });

  it("can switch from _ to __ leaving unbroken keys flat", () => {
    const describe: DescribeConfig = {
      TargetFile: ".env",
      Separator: "_",
      Parameters: {
        HOST: {
          NAME: field({ InitialValue: "app", Label: "Host name" }),
        },
      },
    };
    const result = restructureDescribeForSeparator(
      describe,
      { "HOST.NAME": "app" },
      { HOST_NAME: "app" },
      "__",
    );
    expect(result.describe.Separator).toBe("__");
    // No __ in key → single leaf HOST_NAME
    expect(result.describe.Parameters.HOST_NAME).toMatchObject({
      Label: "Host name",
      InitialValue: "app",
    });
    expect(result.values.HOST_NAME).toBe("app");
  });
});
