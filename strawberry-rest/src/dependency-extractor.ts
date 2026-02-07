import type { Dependency, OperationShape } from "./types.js";

const normalizeField = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

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
          kind: "body"
        });
      }
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
        kind: "path"
      });
    }
  }

  return dependencies;
};

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
        kind: "auth"
      });
    }
  }

  return dependencies;
};
