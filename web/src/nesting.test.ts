import { describe, expect, it } from "vitest";
import {
  detectEnvSeparator,
  flattenToEnvRecord,
  splitEnvKey,
  unflattenEnvRecord,
} from "./nesting";

describe("web nesting helpers", () => {
  it("mirrors server unflatten/flatten behavior", () => {
    const flat = { DB_SERVER: "localhost", DB_PORT: "5432" };
    expect(detectEnvSeparator(flat)).toBe("_");
    expect(splitEnvKey("DB_SERVER", "_")).toEqual(["DB", "SERVER"]);
    const nested = unflattenEnvRecord(flat, "_");
    expect(nested).toEqual({ DB: { SERVER: "localhost", PORT: "5432" } });
    expect(flattenToEnvRecord(nested, "_")).toEqual(flat);
  });
});
