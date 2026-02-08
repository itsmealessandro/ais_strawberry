// Infers dependencies between operations based on field compatibility.
import type { Dependency, OperationShape } from "./types.js";

// Normalize field names to improve matching across naming styles.
const normalizeField = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Split a field name into lowercase tokens for heuristic matching.
const splitTokens = (name: string) =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Infer entity name from fields like cartId/orderId.
const inferEntityFromField = (fieldName: string) => {
  const tokens = splitTokens(fieldName);
  const idIndex = tokens.findIndex((token) => token === "id");
  if (idIndex > 0) {
    return tokens[idIndex - 1];
  }
  return undefined;
};

// Match source response fields to target inputs across body and params.
const matchFields = (source: OperationShape, target: OperationShape) => {
  const dependencies: Dependency[] = [];
  const sourceFields = source.responseFields.map((field) => ({
    field,
    key: normalizeField(field.name),
    type: field.type
  }));
  const targetFields = target.requestFields.map((field) => ({
    field,
    key: normalizeField(field.name),
    type: field.type
  }));

  for (const sourceField of sourceFields) {
    for (const targetField of targetFields) {
      if (sourceField.key && sourceField.key === targetField.key && sourceField.type === targetField.type) {
        dependencies.push({
          fromOperation: source.id,
          toOperation: target.id,
          field: targetField.field.name,
          type: targetField.type,
          kind: "body",
          reason: "exact-name"
        });
      }
    }
  }

  for (const targetField of target.requestFields) {
    const targetEntity = inferEntityFromField(targetField.name);
    if (!targetEntity) {
      continue;
    }
    const entityMatch = source.responseFields.find((field) =>
      field.name === "id" && field.entity?.toLowerCase() === targetEntity
    );
    if (entityMatch && entityMatch.type === targetField.type) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: targetField.name,
        type: targetField.type,
        kind: "body",
        reason: "entity-id"
      });
    }
  }

  for (const pathParam of target.pathParams) {
    const key = normalizeField(pathParam.name);
    const match = sourceFields.find((field) => field.key === key && field.type === pathParam.type);
    if (match) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: pathParam.name,
        type: pathParam.type,
        kind: "path",
        reason: "exact-name"
      });
      continue;
    }

    const entity = inferEntityFromField(pathParam.name);
    const entityMatch = source.responseFields.find((field) =>
      field.name === "id" && field.entity?.toLowerCase() === entity
    );
    if (entityMatch && entityMatch.type === pathParam.type) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: pathParam.name,
        type: pathParam.type,
        kind: "path",
        reason: "entity-id"
      });
    }
  }

  for (const param of target.otherParams) {
    const key = normalizeField(param.name);
    const match = sourceFields.find((field) => field.key === key && field.type === param.type);
    if (match) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: param.name,
        type: param.type,
        kind: param.location,
        reason: "exact-name"
      });
      continue;
    }

    const entity = inferEntityFromField(param.name);
    if (!entity) {
      continue;
    }
    const entityMatch = source.responseFields.find((field) =>
      field.name === "id" && field.entity?.toLowerCase() === entity
    );
    if (entityMatch && entityMatch.type === param.type) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: param.name,
        type: param.type,
        kind: param.location,
        reason: "entity-id"
      });
    }
  }

  return dependencies;
};

// Compute all dependencies and add auth relations.
export const extractDependencies = (operations: OperationShape[]) => {
  const dependencies: Dependency[] = [];
  for (const source of operations) {
    for (const target of operations) {
      if (source.id === target.id) {
        continue;
      }
      dependencies.push(...matchFields(source, target));
    }
  }

  const tokenProviders = operations.filter((op) =>
    op.responseFields.some((field) => normalizeField(field.name).includes("token"))
  );
  const tokenConsumers = operations.filter((op) => op.requiresAuth);

  for (const provider of tokenProviders) {
    for (const consumer of tokenConsumers) {
      if (provider.id === consumer.id) {
        continue;
      }
      dependencies.push({
        fromOperation: provider.id,
        toOperation: consumer.id,
        field: "Authorization",
        type: "string",
        kind: "auth",
        reason: "auth"
      });
    }
  }

  return dependencies;
};
