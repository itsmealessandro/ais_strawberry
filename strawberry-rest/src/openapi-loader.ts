import fs from "fs";
import path from "path";
import YAML from "yaml";
import type { OpenApiSpec } from "./types.js";

const loadFile = (filePath: string) => {
  const raw = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(raw);
  }
  return YAML.parse(raw);
};

const resolveRefPath = (ref: string) => {
  const [, pointer] = ref.split("#");
  if (!pointer) {
    return [];
  }
  return pointer.split("/").filter(Boolean).map(decodeURIComponent);
};

export const resolveRef = (spec: OpenApiSpec, ref: string) => {
  const segments = resolveRefPath(ref);
  let current: any = spec;
  for (const segment of segments) {
    if (current?.[segment] === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

export const loadOpenApiSpec = (specPath: string): OpenApiSpec => {
  const resolvedPath = path.resolve(specPath);
  const spec = loadFile(resolvedPath) as OpenApiSpec;
  if (!spec.openapi) {
    throw new Error("Invalid OpenAPI spec: missing openapi field");
  }
  return spec;
};
