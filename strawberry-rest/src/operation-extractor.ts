// Extracts operation shapes from an OpenAPI spec.
import type {
  FieldShape,
  OpenApiSpec,
  OperationObject,
  OperationShape,
  ParamShape,
  PathItemObject,
  RequestBodyObject,
  ResponseObject
} from "./types.js";
import { flattenSchema } from "./schema-flattener.js";

// Pick the JSON schema from a request body, falling back to the first media type.
const pickJsonSchema = (body?: RequestBodyObject) => {
  if (!body?.content) {
    return undefined;
  }
  return body.content["application/json"]?.schema ?? Object.values(body.content)[0]?.schema;
};

// Select the first 2xx response, if present.
const pickSuccessResponse = (responses?: Record<string, ResponseObject>) => {
  if (!responses) {
    return undefined;
  }
  const successKey = Object.keys(responses).find((code) => code.startsWith("2"));
  if (!successKey) {
    return undefined;
  }
  return responses[successKey];
};

// Extract the referenced schema name for entity tagging.
const extractSchemaName = (schema?: { $ref?: string }) => {
  if (!schema?.$ref) {
    return undefined;
  }
  const parts = schema.$ref.split("/");
  return parts[parts.length - 1];
};

// Convert a parameter into a uniform ParamShape.
const toParamShape = (param: OperationObject["parameters"][number]): ParamShape => ({
  name: param.name,
  type: param.schema?.type ?? "string",
  format: param.schema?.format,
  location: param.in
});

// Collect path parameters for an operation.
const extractPathParams = (parameters: OperationObject["parameters"]) => {
  if (!parameters) {
    return [] as ParamShape[];
  }
  return parameters.filter((param) => param.in === "path").map(toParamShape);
};

// Collect query, header, and cookie parameters for an operation.
const extractOtherParams = (parameters: OperationObject["parameters"]) => {
  if (!parameters) {
    return [] as ParamShape[];
  }
  return parameters
    .filter((param) => param.in === "query" || param.in === "header" || param.in === "cookie")
    .map(toParamShape);
};

// Extract flattened request body fields and tag with entity name.
const extractRequestFields = (spec: OpenApiSpec, operation: OperationObject) => {
  const schema = pickJsonSchema(operation.requestBody);
  const entity = extractSchemaName(schema);
  return flattenSchema(spec, schema).map((field) => ({ ...field, entity }));
};

// Extract flattened response body fields and tag with entity name.
const extractResponseFields = (spec: OpenApiSpec, operation: OperationObject) => {
  const response = pickSuccessResponse(operation.responses);
  if (!response?.content) {
    return [] as FieldShape[];
  }
  const schema = response.content["application/json"]?.schema ?? Object.values(response.content)[0]?.schema;
  const entity = extractSchemaName(schema);
  return flattenSchema(spec, schema).map((field) => ({ ...field, entity }));
};

// Detect bearerAuth usage on an operation.
const hasBearerAuth = (operation: OperationObject) => {
  if (!operation.security) {
    return false;
  }
  return operation.security.some((scheme) => Object.keys(scheme).includes("bearerAuth"));
};

// Determine a stable operation id for reporting.
const getOperationId = (method: string, path: string, operation: OperationObject) => {
  return operation.operationId ?? `${method.toUpperCase()} ${path}`;
};

// Build the operation list for the whole spec.
export const extractOperations = (spec: OpenApiSpec): OperationShape[] => {
  const shapes: OperationShape[] = [];
  const paths = spec.paths ?? {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const operations = pathItem as PathItemObject;
    for (const [method, operation] of Object.entries(operations)) {
      const op = operation as OperationObject;
      if (!op || !op.responses) {
        continue;
      }
      const id = getOperationId(method, pathKey, op);
      const requestFields = extractRequestFields(spec, op);
      const responseFields = extractResponseFields(spec, op);
      const pathParams = extractPathParams(op.parameters);
      const otherParams = extractOtherParams(op.parameters);
      const requiresAuth = hasBearerAuth(op);

      shapes.push({
        id,
        method: method as OperationShape["method"],
        path: pathKey,
        requestFields,
        responseFields,
        pathParams,
        otherParams,
        requiresAuth
      });
    }
  }

  return shapes;
};
