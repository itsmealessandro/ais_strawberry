// Extracts example inputs for operations from OpenAPI.
import type { OperationObject, ParameterObject, RequestBodyObject } from "./types.js";

export type ExampleInput = {
  body?: Record<string, unknown>;
  params: {
    path: Record<string, string>;
    query: Record<string, string>;
    header: Record<string, string>;
    cookie: Record<string, string>;
  };
};

const pickExample = (value?: unknown, examples?: Record<string, { value?: unknown } | unknown>) => {
  if (value !== undefined) {
    return value;
  }
  if (!examples) {
    return undefined;
  }
  const first = Object.values(examples)[0];
  if (first && typeof first === "object" && "value" in first) {
    return (first as { value?: unknown }).value;
  }
  return first as unknown;
};

const normalizeParamValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }
  return JSON.stringify(value);
};

const extractParamExample = (param: ParameterObject) => {
  const direct = pickExample(param.example, param.examples);
  if (direct !== undefined) {
    return direct;
  }
  return pickExample(param.schema?.example, param.schema?.examples);
};

const extractRequestExample = (body?: RequestBodyObject) => {
  if (!body?.content) {
    return undefined;
  }
  const mediaType = body.content["application/json"] ?? Object.values(body.content)[0];
  const direct = pickExample(mediaType?.example, mediaType?.examples);
  if (direct !== undefined) {
    return direct as Record<string, unknown>;
  }
  const schemaExample = pickExample(mediaType?.schema?.example, mediaType?.schema?.examples);
  return schemaExample as Record<string, unknown> | undefined;
};

export const extractExampleInputs = (operation: OperationObject): ExampleInput => {
  const params = operation.parameters ?? [];
  const paramValues: ExampleInput["params"] = {
    path: {},
    query: {},
    header: {},
    cookie: {}
  };

  for (const param of params) {
    const example = extractParamExample(param);
    const value = normalizeParamValue(example);
    if (param.in === "path") {
      paramValues.path[param.name] = value;
    } else if (param.in === "query") {
      paramValues.query[param.name] = value;
    } else if (param.in === "header") {
      paramValues.header[param.name] = value;
    } else if (param.in === "cookie") {
      paramValues.cookie[param.name] = value;
    }
  }

  const body = extractRequestExample(operation.requestBody);
  return { body, params: paramValues };
};
