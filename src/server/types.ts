export type FieldType = "string" | "number" | "boolean" | "json";

export interface FieldMeta {
  InitialValue: unknown;
  Type: FieldType;
  Description: string;
  Label: string;
  Required: boolean;
}

/** Nested map mirroring appsettings; leaves are FieldMeta */
export type ParameterNode = FieldMeta | { [key: string]: ParameterNode };

export interface DescribeConfig {
  TargetFile: string;
  Parameters: Record<string, ParameterNode>;
}

export interface OpenResult {
  targetPath: string;
  describePath: string;
  appsettings: unknown;
  describe: DescribeConfig;
  createdDescribe: boolean;
  stalePaths: string[];
}

export function isFieldMeta(node: ParameterNode): node is FieldMeta {
  return (
    typeof node === "object" &&
    node !== null &&
    "Type" in node &&
    "InitialValue" in node &&
    "Label" in node
  );
}
