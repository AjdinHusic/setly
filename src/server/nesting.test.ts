import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENV_SEPARATOR,
  applyKeyCasingSegment,
  applyObjectKeyCasing,
  detectEnvSeparator,
  flattenToEnvRecord,
  isValidEnvKey,
  splitEnvKey,
  unflattenEnvRecord,
} from "./nesting.js";

describe("detectEnvSeparator", () => {
  it("prefers double underscore when present", () => {
    expect(detectEnvSeparator({ Host__Name: "x", OTHER: "y" })).toBe("__");
  });

  it("detects colon", () => {
    expect(detectEnvSeparator({ "spring:url": "x" })).toBe(":");
  });

  it("detects dot", () => {
    expect(detectEnvSeparator({ "app.name": "x" })).toBe(".");
  });

  it("detects slash", () => {
    expect(detectEnvSeparator({ "a/b": "x" })).toBe("/");
  });

  it("detects single underscore", () => {
    expect(detectEnvSeparator({ HOST_NAME: "x", DB_PORT: "1" })).toBe("_");
  });

  it("falls back to default when no separator chars", () => {
    expect(detectEnvSeparator({ HOST: "x", PORT: "1" })).toBe(
      DEFAULT_ENV_SEPARATOR,
    );
  });
});

describe("splitEnvKey", () => {
  it("splits on underscore", () => {
    expect(splitEnvKey("HOST_NAME", "_")).toEqual(["HOST", "NAME"]);
  });

  it("splits on double underscore without splitting singles", () => {
    expect(splitEnvKey("Host__Name", "__")).toEqual(["Host", "Name"]);
    expect(splitEnvKey("HOST_NAME", "__")).toEqual(["HOST_NAME"]);
  });

  it("splits on colon and dot", () => {
    expect(splitEnvKey("a:b:c", ":")).toEqual(["a", "b", "c"]);
    expect(splitEnvKey("a.b", ".")).toEqual(["a", "b"]);
  });

  it("returns whole key when separator empty or absent", () => {
    expect(splitEnvKey("HOST_NAME", "")).toEqual(["HOST_NAME"]);
    expect(splitEnvKey("HOST", "_")).toEqual(["HOST"]);
  });
});

describe("unflattenEnvRecord / flattenToEnvRecord", () => {
  it("unflattens with underscore into nested objects", () => {
    expect(
      unflattenEnvRecord(
        { HOST_NAME: "app", HOST_PORT: "80", DB_SERVER: "localhost" },
        "_",
      ),
    ).toEqual({
      HOST: { NAME: "app", PORT: "80" },
      DB: { SERVER: "localhost" },
    });
  });

  it("unflattens with __ (ASP.NET style)", () => {
    expect(
      unflattenEnvRecord({ Host__Name: "x", Host__Port: "1" }, "__"),
    ).toEqual({ Host: { Name: "x", Port: "1" } });
  });

  it("round-trips nested → flat → nested", () => {
    const nested = {
      Host: { Name: "app", Nested: { Flag: true } },
      Port: 80,
    };
    const flat = flattenToEnvRecord(nested, "__");
    expect(flat).toEqual({
      Host__Name: "app",
      Host__Nested__Flag: true,
      Port: 80,
    });
    expect(unflattenEnvRecord(flat, "__")).toEqual(nested);
  });

  it("supports custom separators on flatten", () => {
    expect(flattenToEnvRecord({ A: { B: "v" } }, ":")).toEqual({ "A:B": "v" });
    expect(flattenToEnvRecord({ A: { B: "v" } }, ".")).toEqual({ "A.B": "v" });
  });

  it("copies flat when separator is empty", () => {
    const flat = { HOST_NAME: "x" };
    expect(unflattenEnvRecord(flat, "")).toEqual(flat);
  });

  it("indexes scalar arrays instead of JSON-stringifying", () => {
    expect(flattenToEnvRecord({ List: [1, 2] }, "_")).toEqual({
      List_0: 1,
      List_1: 2,
    });
    expect(
      flattenToEnvRecord({ Features: { AllowedOrigins: ["a", "b"] } }, "_"),
    ).toEqual({
      Features_AllowedOrigins_0: "a",
      Features_AllowedOrigins_1: "b",
    });
  });

  it("round-trips indexed list keys back to arrays", () => {
    const flat = {
      Features_AllowedOrigins_0: "a",
      Features_AllowedOrigins_1: "b",
    };
    expect(unflattenEnvRecord(flat, "_")).toEqual({
      Features: { AllowedOrigins: ["a", "b"] },
    });
  });

  it("still JSON-stringifies arrays of objects", () => {
    expect(flattenToEnvRecord({ Rows: [{ a: 1 }] }, "_")).toEqual({
      Rows: '[{"a":1}]',
    });
  });

  it("throws when root is not an object", () => {
    expect(() => flattenToEnvRecord("nope", "_")).toThrow(/object/);
  });
});

describe("key casing", () => {
  it("transforms segments", () => {
    expect(applyKeyCasingSegment("HOST_NAME", "camelCase")).toBe("hostName");
    expect(applyKeyCasingSegment("host_name", "PascalCase")).toBe("HostName");
    expect(applyKeyCasingSegment("Host", "UPPERCASE")).toBe("HOST");
    expect(applyKeyCasingSegment("Host", "lowercase")).toBe("host");
    expect(applyKeyCasingSegment("Host", "preserve")).toBe("Host");
  });

  it("applies casing deeply to object keys", () => {
    expect(
      applyObjectKeyCasing(
        { Host: { Name: "x" }, Port: 1 },
        "camelCase",
      ),
    ).toEqual({ host: { name: "x" }, port: 1 });
    expect(applyObjectKeyCasing({ Host: "x" }, "preserve")).toEqual({
      Host: "x",
    });
  });
});

describe("isValidEnvKey", () => {
  it("accepts common env key shapes", () => {
    expect(isValidEnvKey("HOST_NAME")).toBe(true);
    expect(isValidEnvKey("Host__Name")).toBe(true);
    expect(isValidEnvKey("a:b")).toBe(true);
    expect(isValidEnvKey("a.b")).toBe(true);
    expect(isValidEnvKey("_private")).toBe(true);
  });

  it("rejects invalid keys", () => {
    expect(isValidEnvKey("1HOST")).toBe(false);
    expect(isValidEnvKey("HOST NAME")).toBe(false);
    expect(isValidEnvKey("")).toBe(false);
  });
});
