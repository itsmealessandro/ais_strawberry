// Runtime refinement for inferred dependencies using a sample REST flow.
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadOpenApiSpec } from "./openapi-loader.js";
import { extractOperations } from "./operation-extractor.js";
import { extractDependencies } from "./dependency-extractor.js";
import { writeJsonReport, writeMarkdownSummary } from "./report-writer.js";
import { requestJson } from "./http-client.js";
import type { Dependency, OperationShape } from "./types.js";

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
};

type RuntimeContext = {
  baseUrl: string;
  token?: string;
  cartId?: string;
  orderId?: string;
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
  .parseSync();

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

const verifyDependency = (
  dependency: Dependency,
  fromEvidence?: OperationEvidence,
  toEvidence?: OperationEvidence
) => {
  if (!fromEvidence || !toEvidence) {
    return "unverified" as const;
  }

  const providerValue = (() => {
    if (dependency.kind === "auth") {
      return findTokenValue(fromEvidence.response);
    }
    if (dependency.reason === "entity-id") {
      return fromEvidence.response.id ?? findByNormalizedKey(fromEvidence.response, "id");
    }
    return fromEvidence.response[dependency.field] ?? findByNormalizedKey(fromEvidence.response, dependency.field);
  })();

  const consumerValue = (() => {
    if (dependency.kind === "auth") {
      return extractBearerToken(toEvidence.request.header.authorization);
    }
    if (dependency.kind === "body") {
      return getValueByPath(toEvidence.request.body, dependency.field);
    }
    if (dependency.kind === "path") {
      return toEvidence.request.path[dependency.field] ?? findByNormalizedKey(toEvidence.request.path, dependency.field);
    }
    if (dependency.kind === "query") {
      return toEvidence.request.query[dependency.field] ?? findByNormalizedKey(toEvidence.request.query, dependency.field);
    }
    if (dependency.kind === "header") {
      return toEvidence.request.header[dependency.field.toLowerCase()];
    }
    if (dependency.kind === "cookie") {
      return toEvidence.request.cookie[dependency.field] ?? findByNormalizedKey(toEvidence.request.cookie, dependency.field);
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
const operations = extractOperations(spec);
const dependencies = extractDependencies(operations);
const evidence = new Map<string, OperationEvidence>();

const callAndRecord = async (
  ctx: RuntimeContext,
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  options?: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    cookie?: Record<string, string>;
  }
) => {
  const url = new URL(path, ctx.baseUrl);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = options?.headers ?? {};
  const response = await requestJson(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  const operation = matchOperation(operations, method, url.pathname);
  if (!operation) {
    throw new Error(`No operation matched for ${method.toUpperCase()} ${url.pathname}`);
  }

  const requestEvidence: RequestEvidence = {
    body: options?.body ?? {},
    path: extractPathParams(operation.path, url.pathname),
    query: options?.query ?? {},
    header: normalizeHeaders(headers),
    cookie: options?.cookie ?? {}
  };

  evidence.set(operation.id, {
    request: requestEvidence,
    response: buildResponseMap(operation, response.data)
  });

  return response;
};

const registerAndLogin = async (ctx: RuntimeContext) => {
  const email = `user_${Date.now()}@example.com`;
  await callAndRecord(ctx, "post", "/auth/register", {
    headers: { "Content-Type": "application/json" },
    body: { email, password: "Secret123!" }
  });

  const login = await callAndRecord(ctx, "post", "/auth/login", {
    headers: { "Content-Type": "application/json" },
    body: { email, password: "Secret123!" }
  });

  if (login.status !== 200 || !login.data || typeof login.data !== "object") {
    throw new Error("Login failed during refinement");
  }
  ctx.token = (login.data as { token?: string }).token;
};

const createCart = async (ctx: RuntimeContext) => {
  const cart = await callAndRecord(ctx, "post", "/carts", {
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  if (cart.status !== 201 || !cart.data || typeof cart.data !== "object") {
    throw new Error("Cart creation failed during refinement");
  }
  ctx.cartId = (cart.data as { id?: string }).id;
};

const addItem = async (ctx: RuntimeContext) => {
  const products = await callAndRecord(ctx, "get", "/products");
  if (products.status !== 200 || !Array.isArray(products.data)) {
    throw new Error("Unable to fetch products during refinement");
  }
  const first = products.data[0] as { id?: string };
  const add = await callAndRecord(ctx, "post", `/carts/${ctx.cartId}/items`, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json"
    },
    body: { productId: first.id, quantity: 1 }
  });
  if (add.status !== 200) {
    throw new Error("Add item failed during refinement");
  }
};

const createOrder = async (ctx: RuntimeContext) => {
  const order = await callAndRecord(ctx, "post", "/orders", {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json"
    },
    body: { cartId: ctx.cartId }
  });
  if (order.status !== 201 || !order.data || typeof order.data !== "object") {
    throw new Error("Order creation failed during refinement");
  }
  ctx.orderId = (order.data as { id?: string }).id;
};

const fetchOrder = async (ctx: RuntimeContext) => {
  const order = await callAndRecord(ctx, "get", `/orders/${ctx.orderId}`, {
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  if (order.status !== 200) {
    throw new Error("Order retrieval failed during refinement");
  }
};

const run = async () => {
  console.log(`Refining ${dependencies.length} dependencies against ${argv.base}`);
  const ctx: RuntimeContext = { baseUrl: argv.base };
  await registerAndLogin(ctx);
  await createCart(ctx);
  await addItem(ctx);
  await createOrder(ctx);
  await fetchOrder(ctx);

  const refined: Dependency[] = dependencies.map((dependency) => ({
    ...dependency,
    verification: verifyDependency(
      dependency,
      evidence.get(dependency.fromOperation),
      evidence.get(dependency.toOperation)
    )
  }));

  writeJsonReport(argv.out, { operations, dependencies: refined });
  writeMarkdownSummary(argv.out, operations, refined);

  const verified = refined.filter((dep) => dep.verification === "verified").length;
  console.log(`Verified ${verified}/${refined.length} dependencies.`);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error("Refinement failed:", message);
  process.exit(1);
});
