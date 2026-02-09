// Validates OpenAPI specs to decide if analysis can proceed.
import type { OpenApiSpec, OperationObject, PathItemObject, ParameterObject, ResponseObject } from "./types.js";

export type ValidationStats = {
  totalOperations: number;
  operationsWith2xx: number;
  operationsWithResponseSchema: number;
  operationsWithRequestSchema: number;
  paramsMissingSchema: number;
  authOperations: number;
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  stats: ValidationStats;
};

const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

const getOperationId = (method: string, path: string, operation: OperationObject) => {
  return operation.operationId ?? `${method.toUpperCase()} ${path}`;
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

const hasSchema = (response?: ResponseObject) => {
  if (!response?.content) {
    return false;
  }
  const schema = response.content["application/json"]?.schema ?? Object.values(response.content)[0]?.schema;
  return Boolean(schema);
};

const hasRequestSchema = (operation: OperationObject) => {
  const body = operation.requestBody;
  if (!body?.content) {
    return false;
  }
  const schema = body.content["application/json"]?.schema ?? Object.values(body.content)[0]?.schema;
  return Boolean(schema);
};

const countMissingParamSchemas = (parameters?: ParameterObject[]) => {
  if (!parameters) {
    return 0;
  }
  return parameters.filter((param) => !param.schema || !param.schema.type).length;
};

export const validateOpenApiSpec = (spec: OpenApiSpec): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: ValidationStats = {
    totalOperations: 0,
    operationsWith2xx: 0,
    operationsWithResponseSchema: 0,
    operationsWithRequestSchema: 0,
    paramsMissingSchema: 0,
    authOperations: 0
  };

  if (!spec.openapi) {
    errors.push("Missing openapi field.");
    return { errors, warnings, stats };
  }

  const paths = spec.paths ?? {};
  const pathEntries = Object.entries(paths);
  if (pathEntries.length === 0) {
    errors.push("No paths found in the OpenAPI spec.");
    return { errors, warnings, stats };
  }

  for (const [pathKey, pathItem] of pathEntries) {
    const operations = pathItem as PathItemObject;
    for (const [method, operation] of Object.entries(operations)) {
      if (!httpMethods.has(method)) {
        continue;
      }
      const op = operation as OperationObject | undefined;
      if (!op) {
        continue;
      }
      stats.totalOperations += 1;
      const opId = getOperationId(method, pathKey, op);

      const successResponse = pickSuccessResponse(op.responses);
      if (successResponse) {
        stats.operationsWith2xx += 1;
      } else {
        warnings.push(`Operation ${opId} has no 2xx response.`);
      }

      if (hasSchema(successResponse)) {
        stats.operationsWithResponseSchema += 1;
      } else if (successResponse) {
        warnings.push(`Operation ${opId} has a 2xx response without a schema.`);
      }

      if (hasRequestSchema(op)) {
        stats.operationsWithRequestSchema += 1;
      } else if (op.requestBody?.required) {
        warnings.push(`Operation ${opId} has a required request body without a schema.`);
      }

      stats.paramsMissingSchema += countMissingParamSchemas(op.parameters);

      if (op.security && op.security.length > 0) {
        stats.authOperations += 1;
        const schemes = spec.components?.securitySchemes ?? {};
        for (const security of op.security) {
          for (const schemeName of Object.keys(security)) {
            if (!schemes[schemeName]) {
              warnings.push(`Operation ${opId} references missing security scheme '${schemeName}'.`);
            }
          }
        }
      }
    }
  }

  if (stats.totalOperations === 0) {
    errors.push("No operations found in OpenAPI paths.");
  }

  if (stats.operationsWith2xx === 0 && stats.totalOperations > 0) {
    errors.push("No operations expose a 2xx response; dependency extraction cannot proceed.");
  }

  if (stats.paramsMissingSchema > 0) {
    warnings.push(`Found ${stats.paramsMissingSchema} parameters without schema/type.`);
  }

  return { errors, warnings, stats };
};
