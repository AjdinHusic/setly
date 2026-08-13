import { describe, expect, it } from "vitest";
import {
  parseDotEnv,
  serializeDotEnv,
  flattenToEnvRecord,
} from "./dotEnvProvider.js";

describe("parseDotEnv", () => {
  it("parses basic KEY=VALUE pairs", () => {
    expect(parseDotEnv("A=1\nB=two\n")).toEqual({ A: "1", B: "two" });
  });

  it("skips blanks and comments", () => {
    expect(parseDotEnv("# hi\n\nA=1\n  # x\n")).toEqual({ A: "1" });
  });

  it("supports export prefix and quoted values", () => {
    expect(parseDotEnv('export NAME="hello world"\n')).toEqual({
      NAME: "hello world",
    });
    expect(parseDotEnv("NAME='x'\n")).toEqual({ NAME: "x" });
  });

  it("allows underscore and double-underscore keys", () => {
    expect(parseDotEnv("HOST_NAME=a\nHost__Name=b\n")).toEqual({
      HOST_NAME: "a",
      Host__Name: "b",
    });
  });

  it("allows colon and slash keys", () => {
    expect(parseDotEnv("a:b=1\nx/y=2\n")).toEqual({ "a:b": "1", "x/y": "2" });
  });

  it("rejects invalid key characters", () => {
    expect(parseDotEnv("1BAD=1\nOK=2\n")).toEqual({ OK: "2" });
  });
});

describe("serializeDotEnv", () => {
  it("flattens nested objects with default separator", () => {
    const text = serializeDotEnv({ Host: { Name: "app" }, Port: 80 });
    expect(text).toContain("Host_Name=app");
    expect(text).toContain("Port=80");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("uses custom separator", () => {
    const text = serializeDotEnv({ Host: { Name: "app" } }, "__");
    expect(text).toContain("Host__Name=app");
  });

  it("quotes values with spaces or special chars", () => {
    const text = serializeDotEnv({ MSG: "hello world", EMPTY: "" });
    expect(text).toContain('MSG="hello world"');
    expect(text).toContain('EMPTY=""');
  });

  it("round-trips through parse for flat records", () => {
    const original = { A: "1", B: "two words", C: "plain" };
    const nested = { A: "1", B: "two words", C: "plain" };
    const text = serializeDotEnv(nested, "_");
    expect(parseDotEnv(text)).toEqual(original);
  });
});

describe("flattenToEnvRecord (dotenv re-export)", () => {
  it("matches nested flatten with separator", () => {
    expect(flattenToEnvRecord({ A: { B: "v" } }, ":")).toEqual({ "A:B": "v" });
  });
});
