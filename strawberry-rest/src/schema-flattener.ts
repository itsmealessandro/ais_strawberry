// Flattens OpenAPI schemas into simple field lists.
import type { FieldShape, OpenApiSpec, SchemaObject } from "./types.js";
import { resolveRef } from "./openapi-loader.js";

// Merge an allOf schema into a single object schema.
const mergeAllOf = (spec: OpenApiSpec, schema: SchemaObject): SchemaObject => {
  if (!schema.allOf) {
    return schema;
  }
  const merged: SchemaObject = { type: "object", properties: {}, required: [] };
  for (const sub of schema.allOf) {
    const resolved = resolveSchema(spec, sub);
    const properties = resolved.properties ?? {};
    merged.properties = { ...(merged.properties ?? {}), ...properties };
    if (resolved.required) {
      merged.required = [...(merged.required ?? []), ...resolved.required];
    }
  }
  return merged;
};

// Resolve $ref and allOf to return a normalized schema.
export const resolveSchema = (spec: OpenApiSpec, schema?: SchemaObject): SchemaObject => {
  if (!schema) {
    return { type: "object" };
  }
  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return resolveSchema(spec, resolved as SchemaObject);
  }
  if (schema.allOf) {
    return mergeAllOf(spec, schema);
  }
  return schema;
};

// Convert a nested object schema into dotted path fields.
const flattenObject = (schema: SchemaObject, prefix: string): FieldShape[] => {
  const fields: FieldShape[] = [];
  const properties = schema.properties ?? {};
  for (const [name, prop] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (prop.type === "object" && prop.properties) {
      fields.push(...flattenObject(prop, path));
    } else if (prop.type === "array" && prop.items) {
      fields.push({ name: path, type: "array", format: prop.items.type });
    } else {
      fields.push({ name: path, type: prop.type ?? "object", format: prop.format });
    }
  }
  return fields;
};

// Flatten any schema into a list of FieldShape entries.
export const flattenSchema = (spec: OpenApiSpec, schema?: SchemaObject): FieldShape[] => {
  const resolved = resolveSchema(spec, schema);
  if (resolved.type === "object") {
    return flattenObject(resolved, "");
  }
  if (resolved.type === "array" && resolved.items) {
    return [{ name: "[]", type: "array", format: resolved.items.type }];
  }
  return [{ name: "value", type: resolved.type ?? "object", format: resolved.format }];
};
