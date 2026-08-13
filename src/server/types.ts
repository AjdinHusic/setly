export type ScalarFieldType = "string" | "number" | "boolean";
export type FieldType =
  | ScalarFieldType
  | "json"
  | "dropdown"
  | "list";

export interface DropdownOption {
  Label: string;
  Value: string;
}

export interface FieldMeta {
  InitialValue: unknown;
  Type: FieldType;
  Description: string;
  Label: string;
  Required: boolean;
  /** Present when Type is "dropdown" — label/value pairs for the select. */
  Options?: DropdownOption[];
  /** Present when Type is "list" — element type (string, number, or boolean). */
  ItemType?: ScalarFieldType;
}

/** Nested map mirroring appsettings; leaves are FieldMeta */
export type ParameterNode = FieldMeta | { [key: string]: ParameterNode };

export interface DescribeConfig {
  TargetFile: string;
  Parameters: Record<string, ParameterNode>;
  /**
   * Nesting separator for flat key formats (dotenv).
   * Example: "_" turns HOST_NAME into Host → Name sections.
   */
  Separator?: string;
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
