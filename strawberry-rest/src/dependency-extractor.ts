// Infers dependencies between operations based on field compatibility.
import type { Dependency, OperationShape } from "./types.js";

// Normalize field names to improve matching across naming styles.
const normalizeField = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeTokens = (name: string) =>
  splitTokens(name)
    .map((token) => token.replace(/ids?$/, "id"))
    .filter((token) => token !== "the" && token !== "a" && token !== "an");

const tokensToKey = (tokens: string[]) => tokens.join("");

const getFormat = (field: { format?: string }) => field.format ?? "";

const isCompatibleType = (a: { type: string; format?: string }, b: { type: string; format?: string }) => {
  if (a.type !== b.type) {
    return false;
  }
  if (!a.format || !b.format) {
    return true;
  }
  return a.format === b.format;
};

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
    tokenKey: tokensToKey(normalizeTokens(field.name)),
    type: field.type
  }));
  const targetFields = target.requestFields.map((field) => ({
    field,
    key: normalizeField(field.name),
    tokenKey: tokensToKey(normalizeTokens(field.name)),
    type: field.type
  }));

  for (const sourceField of sourceFields) {
    for (const targetField of targetFields) {
      if (sourceField.key && sourceField.key === targetField.key && isCompatibleType(sourceField, targetField)) {
        const hasFormat = getFormat(sourceField.field) && getFormat(targetField.field);
        dependencies.push({
          fromOperation: source.id,
          toOperation: target.id,
          field: targetField.field.name,
          type: targetField.type,
          kind: "body",
          reason: "exact-name",
          confidence: hasFormat ? 0.95 : 0.9
        });
        continue;
      }
      if (
        sourceField.tokenKey &&
        sourceField.tokenKey === targetField.tokenKey &&
        isCompatibleType(sourceField, targetField)
      ) {
        dependencies.push({
          fromOperation: source.id,
          toOperation: target.id,
          field: targetField.field.name,
          type: targetField.type,
          kind: "body",
          reason: "token-match",
          confidence: 0.7
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
    if (entityMatch && isCompatibleType(entityMatch, targetField)) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: targetField.name,
        type: targetField.type,
        kind: "body",
        reason: "entity-id",
        confidence: 0.8
      });
    }
  }

  for (const pathParam of target.pathParams) {
    const key = normalizeField(pathParam.name);
    const match = sourceFields.find((field) => field.key === key && isCompatibleType(field, pathParam));
    if (match) {
      const hasFormat = getFormat(match.field) && getFormat(pathParam);
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: pathParam.name,
        type: pathParam.type,
        kind: "path",
        reason: "exact-name",
        confidence: hasFormat ? 0.95 : 0.9
      });
      continue;
    }

    const entity = inferEntityFromField(pathParam.name);
    const entityMatch = source.responseFields.find((field) =>
      field.name === "id" && field.entity?.toLowerCase() === entity
    );
    if (entityMatch && isCompatibleType(entityMatch, pathParam)) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: pathParam.name,
        type: pathParam.type,
        kind: "path",
        reason: "entity-id",
        confidence: 0.8
      });
    }
  }

  for (const param of target.otherParams) {
    const key = normalizeField(param.name);
    const match = sourceFields.find((field) => field.key === key && isCompatibleType(field, param));
    if (match) {
      const hasFormat = getFormat(match.field) && getFormat(param);
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: param.name,
        type: param.type,
        kind: param.location,
        reason: "exact-name",
        confidence: hasFormat ? 0.95 : 0.9
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
    if (entityMatch && isCompatibleType(entityMatch, param)) {
      dependencies.push({
        fromOperation: source.id,
        toOperation: target.id,
        field: param.name,
        type: param.type,
        kind: param.location,
        reason: "entity-id",
        confidence: 0.8
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
        reason: "auth",
        confidence: 0.85
      });
    }
  }

  return dependencies;
};
