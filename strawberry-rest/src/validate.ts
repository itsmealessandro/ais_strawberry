import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadOpenApiSpec } from "./openapi-loader.js";
import { extractOperations } from "./operation-extractor.js";
import { extractDependencies } from "./dependency-extractor.js";
import { requestJson } from "./http-client.js";

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
  .parseSync();

const spec = loadOpenApiSpec(argv.spec);
const operations = extractOperations(spec);
const dependencies = extractDependencies(operations);

const registerAndLogin = async (ctx: RuntimeContext) => {
  const email = `user_${Date.now()}@example.com`;
  await requestJson(`${ctx.baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Secret123!" })
  });

  const login = await requestJson(`${ctx.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Secret123!" })
  });

  if (login.status !== 200 || !login.data || typeof login.data !== "object") {
    throw new Error("Login failed during validation");
  }
  ctx.token = (login.data as { token?: string }).token;
};

const createCart = async (ctx: RuntimeContext) => {
  const cart = await requestJson(`${ctx.baseUrl}/carts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  if (cart.status !== 201 || !cart.data || typeof cart.data !== "object") {
    throw new Error("Cart creation failed during validation");
  }
  ctx.cartId = (cart.data as { id?: string }).id;
};

const addItem = async (ctx: RuntimeContext) => {
  const products = await requestJson(`${ctx.baseUrl}/products`);
  if (products.status !== 200 || !Array.isArray(products.data)) {
    throw new Error("Unable to fetch products during validation");
  }
  const first = products.data[0] as { id?: string };
  const add = await requestJson(`${ctx.baseUrl}/carts/${ctx.cartId}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId: first.id, quantity: 1 })
  });
  if (add.status !== 200) {
    throw new Error("Add item failed during validation");
  }
};

const createOrder = async (ctx: RuntimeContext) => {
  const order = await requestJson(`${ctx.baseUrl}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cartId: ctx.cartId })
  });
  if (order.status !== 201 || !order.data || typeof order.data !== "object") {
    throw new Error("Order creation failed during validation");
  }
  ctx.orderId = (order.data as { id?: string }).id;
};

const fetchOrder = async (ctx: RuntimeContext) => {
  const order = await requestJson(`${ctx.baseUrl}/orders/${ctx.orderId}`, {
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  if (order.status !== 200) {
    throw new Error("Order retrieval failed during validation");
  }
};

const run = async () => {
  console.log(`Validating ${dependencies.length} dependencies against ${argv.base}`);
  const ctx: RuntimeContext = { baseUrl: argv.base };
  await registerAndLogin(ctx);
  await createCart(ctx);
  await addItem(ctx);
  await createOrder(ctx);
  await fetchOrder(ctx);
  console.log("Validation flow completed successfully.");
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error("Validation failed:", message);
  process.exit(1);
});
