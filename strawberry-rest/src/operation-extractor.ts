import type {
  FieldShape,
  OpenApiSpec,
  OperationObject,
  OperationShape,
  PathItemObject,
  RequestBodyObject,
  ResponseObject
} from "./types.js";
import { flattenSchema } from "./schema-flattener.js";

const pickJsonSchema = (body?: RequestBodyObject) => {
  if (!body?.content) {
    return undefined;
  }
  return body.content["application/json"]?.schema ?? Object.values(body.content)[0]?.schema;
};

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

const extractSchemaName = (schema?: { $ref?: string }) => {
  if (!schema?.$ref) {
    return undefined;
  }
  const parts = schema.$ref.split("/");
  return parts[parts.length - 1];
};

const extractPathParams = (parameters: OperationObject["parameters"]) => {
  if (!parameters) {
    return [] as FieldShape[];
  }
  return parameters
    .filter((param) => param.in === "path")
    .map((param) => ({
      name: param.name,
      type: param.schema?.type ?? "string",
      format: param.schema?.format
    }));
};

const extractRequestFields = (spec: OpenApiSpec, operation: OperationObject) => {
  const schema = pickJsonSchema(operation.requestBody);
  const entity = extractSchemaName(schema);
  return flattenSchema(spec, schema).map((field) => ({ ...field, entity }));
};

const extractResponseFields = (spec: OpenApiSpec, operation: OperationObject) => {
  const response = pickSuccessResponse(operation.responses);
  if (!response?.content) {
    return [] as FieldShape[];
  }
  const schema = response.content["application/json"]?.schema ?? Object.values(response.content)[0]?.schema;
  const entity = extractSchemaName(schema);
  return flattenSchema(spec, schema).map((field) => ({ ...field, entity }));
};

const hasBearerAuth = (operation: OperationObject) => {
  if (!operation.security) {
    return false;
  }
  return operation.security.some((scheme) => Object.keys(scheme).includes("bearerAuth"));
};

const getOperationId = (method: string, path: string, operation: OperationObject) => {
  return operation.operationId ?? `${method.toUpperCase()} ${path}`;
};

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
      const requiresAuth = hasBearerAuth(op);

      shapes.push({
        id,
        method: method as OperationShape["method"],
        path: pathKey,
        requestFields,
        responseFields,
        pathParams,
        requiresAuth
      });
    }
  }

  return shapes;
};
