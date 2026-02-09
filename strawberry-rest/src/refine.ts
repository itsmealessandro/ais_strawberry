// Runtime refinement for inferred dependencies using a sample REST flow.
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadOpenApiSpec } from "./openapi-loader.js";
import { validateOpenApiSpec } from "./openapi-validator.js";
import { extractOperations } from "./operation-extractor.js";
import { extractDependencies } from "./dependency-extractor.js";
import { writeAnalysisReport, writeJsonReport, writeMarkdownSummary, writeRefinementDiff } from "./report-writer.js";
import { requestJson } from "./http-client.js";
import type { Dependency, OperationObject, OperationShape, PathItemObject } from "./types.js";
import { extractExampleInputs } from "./example-extractor.js";

type RequestEvidence = {
  body: Record<string, unknown>;
  path: Record<string, string>;
  query: Record<string, string>;
  header: Record<string, string>;
  cookie: Record<string, string>;
};

type OperationEvidence = {
  request: RequestEvidence;
  response: Record<string, unknown>;
  status: number;
  ok: boolean;
  phase: "example" | "filled";
};

type EvidenceBucket = {
  example?: OperationEvidence;
  filled?: OperationEvidence;
};

type IterationSummary = {
  iteration: number;
  phase: "example" | "filled";
  okOperations: number;
  totalOperations: number;
  newOutputs: number;
  newlyVerified: Dependency[];
};

type OutputPool = {
  values: Record<string, unknown[]>;
  entities: Record<string, Record<string, unknown[]>>;
};

type RuntimeContext = {
  baseUrl: string;
};

const argv = yargs(hideBin(process.argv))
  .option("spec", {
    type: "string",
    demandOption: true,
    describe: "Path to OpenAPI spec (YAML or JSON)"
  })
  .option("base", {
    type: "string",
    default: "http://localhost:3000",
    describe: "Base URL of the REST service"
  })
  .option("out", {
    type: "string",
    default: "output",
    describe: "Output directory for reports"
  })
  .option("max-iterations", {
    type: "number",
    default: 5,
    describe: "Maximum refinement iterations"
  })
  .parseSync();

const getAppSlug = (spec: string) => {
  const specDir = path.dirname(spec);
  const dirName = path.basename(specDir);
  if (dirName && dirName !== "." && dirName !== "src" && dirName !== "resources") {
    return dirName;
  }
  return path.basename(spec).replace(/\.(yaml|yml|json)$/i, "");
};

const formatTimestamp = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const outputDir = path.join(argv.out, `${getAppSlug(argv.spec)}-${formatTimestamp(new Date())}`);

const normalizeField = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeHeaders = (headers: Record<string, string>) => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
};

const pathToRegex = (template: string) => {
  const pattern = template.replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
};

const matchOperation = (operations: OperationShape[], method: string, path: string) => {
  return operations.find((op) => op.method === method && pathToRegex(op.path).test(path));
};

const extractPathParams = (template: string, path: string) => {
  const params: Record<string, string> = {};
  const templateParts = template.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  for (let i = 0; i < templateParts.length; i += 1) {
    const part = templateParts[i];
    if (part.startsWith("{") && part.endsWith("}")) {
      const name = part.slice(1, -1);
      params[name] = pathParts[i] ?? "";
    }
  }
  return params;
};

const getValueByPath = (value: unknown, path: string) => {
  if (path === "[]") {
    return Array.isArray(value) ? value : undefined;
  }
  if (!path) {
    return undefined;
  }
  const segments = path.split(".");
  let current: unknown = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const buildResponseMap = (operation: OperationShape, data: unknown) => {
  const values: Record<string, unknown> = {};
  for (const field of operation.responseFields) {
    const value = getValueByPath(data, field.name);
    if (value !== undefined) {
      values[field.name] = value;
    }
  }
  return values;
};

const findByNormalizedKey = (record: Record<string, unknown>, fieldName: string) => {
  const target = normalizeField(fieldName);
  for (const [key, value] of Object.entries(record)) {
    if (normalizeField(key) === target) {
      return value;
    }
  }
  return undefined;
};

const findTokenValue = (record: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(record)) {
    if (normalizeField(key).includes("token")) {
      return value;
    }
  }
  return undefined;
};

const extractBearerToken = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : undefined;
};

const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }
  return JSON.stringify(value);
};

const pickBestEvidence = (bucket?: EvidenceBucket) => {
  if (bucket?.filled?.ok) {
    return bucket.filled;
  }
  if (bucket?.example?.ok) {
    return bucket.example;
  }
  return bucket?.filled ?? bucket?.example;
};

const verifyDependency = (
  dependency: Dependency,
  fromEvidence?: EvidenceBucket,
  toEvidence?: EvidenceBucket
) => {
  const from = pickBestEvidence(fromEvidence);
  const to = pickBestEvidence(toEvidence);
  if (!from || !to) {
    return "unverified" as const;
  }
  if (!from.ok || !to.ok) {
    return "unverified" as const;
  }

  const providerValue = (() => {
    if (dependency.kind === "auth") {
      return findTokenValue(from.response);
    }
    if (dependency.reason === "entity-id") {
      return from.response.id ?? findByNormalizedKey(from.response, "id");
    }
    return from.response[dependency.field] ?? findByNormalizedKey(from.response, dependency.field);
  })();

  const consumerValue = (() => {
    if (dependency.kind === "auth") {
      return extractBearerToken(to.request.header.authorization);
    }
    if (dependency.kind === "body") {
      return getValueByPath(to.request.body, dependency.field);
    }
    if (dependency.kind === "path") {
      return to.request.path[dependency.field] ?? findByNormalizedKey(to.request.path, dependency.field);
    }
    if (dependency.kind === "query") {
      return to.request.query[dependency.field] ?? findByNormalizedKey(to.request.query, dependency.field);
    }
    if (dependency.kind === "header") {
      return to.request.header[dependency.field.toLowerCase()];
    }
    if (dependency.kind === "cookie") {
      return to.request.cookie[dependency.field] ?? findByNormalizedKey(to.request.cookie, dependency.field);
    }
    return undefined;
  })();

  const providerText = normalizeValue(providerValue);
  const consumerText = normalizeValue(consumerValue);
  if (!providerText || !consumerText) {
    return "unverified" as const;
  }
  return providerText === consumerText ? "verified" : "unverified";
};

const spec = loadOpenApiSpec(argv.spec);
const validation = validateOpenApiSpec(spec);
if (validation.errors.length > 0) {
  for (const message of validation.errors) {
    console.error(`Validation error: ${message}`);
  }
  process.exit(1);
}
for (const message of validation.warnings) {
  console.warn(`Validation warning: ${message}`);
}
const operations = extractOperations(spec);
const dependencies = extractDependencies(operations);
const evidence = new Map<string, EvidenceBucket>();

const callAndRecord = async (
  ctx: RuntimeContext,
  operation: OperationShape,
  options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    cookie?: Record<string, string>;
    path?: Record<string, string>;
  },
  phase: OperationEvidence["phase"]
) => {
  let path = operation.path;
  if (options.path) {
    for (const [key, value] of Object.entries(options.path)) {
      path = path.replace(`{${key}}`, value);
    }
  }
  const url = new URL(path, ctx.baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = { ...(options.headers ?? {}) };
  const method = operation.method.toUpperCase();
  const canSendBody = method !== "GET" && method !== "HEAD";
  if (canSendBody && options.body) {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
    if (!hasContentType) {
      headers["Content-Type"] = "application/json";
    }
  }
  const response = await requestJson(url.toString(), {
    method,
    headers,
    body: canSendBody && options.body ? JSON.stringify(options.body) : undefined
  });

  const requestEvidence: RequestEvidence = {
    body: options.body ?? {},
    path: options.path ?? {},
    query: options.query ?? {},
    header: normalizeHeaders(headers),
    cookie: options.cookie ?? {}
  };

  const entry = evidence.get(operation.id) ?? {};
  const record: OperationEvidence = {
    request: requestEvidence,
    response: response.status >= 200 && response.status < 300 ? buildResponseMap(operation, response.data) : {},
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    phase
  };
  if (phase === "example") {
    entry.example = record;
  } else {
    entry.filled = record;
  }
  evidence.set(operation.id, entry);

  return response;
};

const buildOutputPool = (records: Map<string, EvidenceBucket>, ops: OperationShape[]) => {
  const pool: OutputPool = { values: {}, entities: {} };
  const opMap = new Map(ops.map((op) => [op.id, op]));
  for (const [opId, entry] of records.entries()) {
    const chosen = entry.filled?.ok ? entry.filled : entry.example?.ok ? entry.example : undefined;
    if (!chosen) {
      continue;
    }
    const operation = opMap.get(opId);
    for (const [key, value] of Object.entries(chosen.response)) {
      if (!pool.values[key]) {
        pool.values[key] = [];
      }
      pool.values[key].push(value);
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        const first = value[0] as Record<string, unknown>;
        for (const [nestedKey, nestedValue] of Object.entries(first)) {
          if (!pool.values[nestedKey]) {
            pool.values[nestedKey] = [];
          }
          pool.values[nestedKey].push(nestedValue);
        }
      }
      if (operation) {
        const field = operation.responseFields.find((responseField) => responseField.name === key);
        const entity = field?.entity?.toLowerCase();
        if (entity) {
          if (!pool.entities[entity]) {
            pool.entities[entity] = {};
          }
          if (!pool.entities[entity][key]) {
            pool.entities[entity][key] = [];
          }
          pool.entities[entity][key].push(value);
        }
      }
    }
  }
  return pool;
};

const countPoolEntries = (pool: OutputPool) => {
  return Object.values(pool.values).reduce((sum, values) => sum + values.length, 0);
};

const inferEntityFromFieldName = (name: string) => {
  const match = name.match(/([a-z0-9]+)id$/i);
  return match ? match[1].toLowerCase() : undefined;
};

const fillInputsFromPool = (
  operation: OperationShape,
  pool: OutputPool,
  example: ReturnType<typeof extractExampleInputs>
) => {
  const body = { ...(example.body ?? {}) };
  const path = { ...example.params.path };
  const query = { ...example.params.query };
  const header = { ...example.params.header };
  const cookie = { ...example.params.cookie };

  const fillValue = (name: string) => {
    const entity = inferEntityFromFieldName(name);
    if (entity) {
      const entityValues = pool.entities[entity]?.id;
      if (entityValues && entityValues.length > 0) {
        return entityValues[0];
      }
    }
    const direct = pool.values[name]?.[0];
    if (direct !== undefined) {
      return direct;
    }
    const normalized = normalizeField(name);
    for (const [key, values] of Object.entries(pool.values)) {
      if (normalizeField(key) === normalized && values.length > 0) {
        return values[0];
      }
    }
    if (normalized.endsWith("id") && pool.values.id?.length) {
      return pool.values.id[0];
    }
    for (const [key, values] of Object.entries(pool.values)) {
      if (normalizeField(key).endsWith("id") && values.length > 0) {
        return values[0];
      }
    }
    return undefined;
  };

  for (const field of operation.requestFields) {
    const candidate = fillValue(field.name);
    if (candidate !== undefined) {
      const segments = field.name.split(".");
      let cursor: Record<string, unknown> = body;
      for (let i = 0; i < segments.length - 1; i += 1) {
        const segment = segments[i];
        if (!cursor[segment] || typeof cursor[segment] !== "object") {
          cursor[segment] = {};
        }
        cursor = cursor[segment] as Record<string, unknown>;
      }
      cursor[segments[segments.length - 1]] = candidate;
    }
  }

  for (const param of operation.pathParams) {
    const candidate = fillValue(param.name);
    if (candidate !== undefined) {
      path[param.name] = normalizeValue(candidate) ?? "";
    }
  }

  for (const param of operation.otherParams) {
    const target = param.location === "query" ? query : param.location === "header" ? header : cookie;
    const candidate = fillValue(param.name);
    if (candidate !== undefined) {
      target[param.name] = normalizeValue(candidate) ?? "";
    }
  }

  if (operation.requiresAuth) {
    const token = fillValue("token");
    if (token) {
      const tokenValue = normalizeValue(token) ?? "";
      header.Authorization = tokenValue.startsWith("Bearer ") ? tokenValue : `Bearer ${tokenValue}`;
    }
  }

  return { body, path, query, header, cookie };
};

const writeIterationReport = (
  outputPath: string,
  iterations: IterationSummary[],
  totalDependencies: number
) => {
  const lines: string[] = [];
  lines.push("# StrawBerry-REST Refinement Iterations");
  lines.push("");
  lines.push(`Total dependencies: ${totalDependencies}`);
  lines.push("");
  for (const iteration of iterations) {
    lines.push(`## Iteration ${iteration.iteration} (${iteration.phase})`);
    lines.push("");
    lines.push(`- operations ok: ${iteration.okOperations}/${iteration.totalOperations}`);
    lines.push(`- new outputs: ${iteration.newOutputs}`);
    lines.push(`- newly verified dependencies: ${iteration.newlyVerified.length}`);
    lines.push("");
    if (iteration.newlyVerified.length === 0) {
      lines.push("No new dependencies verified in this iteration.");
    } else {
      for (const dep of iteration.newlyVerified) {
        lines.push(
          `- ${dep.fromOperation} -> ${dep.toOperation} [${dep.kind}] ${dep.field}:${dep.type} (${dep.reason})`
        );
      }
    }
    lines.push("");
  }
  fs.writeFileSync(outputPath, lines.join("\n"));
};

const run = async () => {
  console.log(`Refining ${dependencies.length} dependencies against ${argv.base}`);
  const ctx: RuntimeContext = { baseUrl: argv.base };

  const executionResults = new Map<string, { status: number; ok: boolean }>();
  const operationDefinitions = spec.paths ?? {};
  const iterations: IterationSummary[] = [];

  const runIteration = async (phase: "example" | "filled", pool: OutputPool, iteration: number) => {
    let okCount = 0;
    const previousPoolSize = countPoolEntries(pool);
    const previousVerified = new Set(
      dependencies
        .map((dependency) => ({
          id: `${dependency.fromOperation}|${dependency.toOperation}|${dependency.field}|${dependency.kind}`,
          status: verifyDependency(dependency, evidence.get(dependency.fromOperation), evidence.get(dependency.toOperation))
        }))
        .filter((entry) => entry.status === "verified")
        .map((entry) => entry.id)
    );

    for (const operation of operations) {
      const definition = (operationDefinitions[operation.path] as PathItemObject | undefined)?.[
        operation.method
      ] as OperationObject | undefined;
      if (!definition) {
        executionResults.set(operation.id, { status: 0, ok: false });
        console.warn(`Missing OpenAPI definition for ${operation.id}`);
        continue;
      }

      const exampleInputs = extractExampleInputs(definition);
      const filled = phase === "example" ? exampleInputs : fillInputsFromPool(operation, pool, exampleInputs);
      try {
        const response = await callAndRecord(
          ctx,
          operation,
          {
            body: filled.body,
            headers: "params" in filled ? filled.params.header : filled.header,
            query: "params" in filled ? filled.params.query : filled.query,
            cookie: "params" in filled ? filled.params.cookie : filled.cookie,
            path: "params" in filled ? filled.params.path : filled.path
          },
          phase
        );
        if (response.status >= 200 && response.status < 300) {
          okCount += 1;
        }
        executionResults.set(operation.id, { status: response.status, ok: response.status >= 200 && response.status < 300 });
      } catch (error) {
        console.error(`Execution failed for ${operation.id} (${phase}):`, error instanceof Error ? error.message : error);
        executionResults.set(operation.id, { status: 0, ok: false });
      }
    }

    const newPool = buildOutputPool(evidence, operations);
    const newPoolSize = countPoolEntries(newPool);
    const newlyVerified = dependencies.filter((dependency) => {
      const key = `${dependency.fromOperation}|${dependency.toOperation}|${dependency.field}|${dependency.kind}`;
      const status = verifyDependency(dependency, evidence.get(dependency.fromOperation), evidence.get(dependency.toOperation));
      return status === "verified" && !previousVerified.has(key);
    });

    iterations.push({
      iteration,
      phase,
      okOperations: okCount,
      totalOperations: operations.length,
      newOutputs: Math.max(0, newPoolSize - previousPoolSize),
      newlyVerified
    });

    return { okCount, newlyVerified, pool: newPool };
  };

  let currentPool = buildOutputPool(evidence, operations);
  let iteration = 1;
  const first = await runIteration("example", currentPool, iteration);
  currentPool = first.pool;
  iteration += 1;

  for (; iteration <= argv["max-iterations"]; iteration += 1) {
    const result = await runIteration("filled", currentPool, iteration);
    const noSuccess = result.okCount === 0;
    const noNewVerified = result.newlyVerified.length === 0;
    currentPool = result.pool;
    if (noSuccess && noNewVerified) {
      break;
    }
  }

  const refined: Dependency[] = dependencies.map((dependency) => ({
    ...dependency,
    verification: verifyDependency(
      dependency,
      evidence.get(dependency.fromOperation),
      evidence.get(dependency.toOperation)
    )
  }));

  const changes = refined.map((dependency) => {
    const before = "unverified" as const;
    const after = dependency.verification ?? "unverified";
    return { dependency, before, after };
  });

  writeJsonReport(outputDir, {
    operations,
    dependencies: refined,
    refinementChanges: changes,
    operationResults: Array.from(executionResults.entries()).map(([id, result]) => ({
      id,
      status: result.status,
      ok: result.ok
    }))
  });
  writeMarkdownSummary(outputDir, operations, refined);
  writeRefinementDiff(outputDir, refined, changes);
  writeIterationReport(path.join(outputDir, "refinement-iterations.md"), iterations, refined.length);
  writeAnalysisReport(outputDir, {
    specPath: argv.spec,
    operations,
    dependencies: refined,
    validation
  });

  const verified = refined.filter((dep) => dep.verification === "verified").length;
  const changed = changes.filter((item) => item.before !== item.after).length;
  console.log(`Verified ${verified}/${refined.length} dependencies.`);
  console.log(`Changed ${changed}/${changes.length} dependencies after refinement.`);
  console.log(`Refinement diff written to ${outputDir}/refinement-diff.md`);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error("Refinement failed:", message);
  process.exit(1);
});
