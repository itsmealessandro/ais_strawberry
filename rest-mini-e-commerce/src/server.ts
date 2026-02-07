import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { carts, orders, products, users, usersByEmail } from "./data.js";
import { calculateTotal, generateId } from "./utils.js";
import type { AuthPayload, Cart, CartItem, Order, User } from "./types.js";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const jwtSecret = process.env.JWT_SECRET ?? "change_me";

app.use(cors());
app.use(express.json());

const openapiDoc = YAML.load(new URL("../openapi.yaml", import.meta.url).pathname);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

const requireAuth: express.RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, jwtSecret) as AuthPayload;
    res.locals.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

app.post("/auth/register", (req, res) => {
  const { email, password } = req.body as Partial<User>;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (usersByEmail.has(email)) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const user: User = {
    id: generateId("usr"),
    email,
    password
  };
  users.set(user.id, user);
  usersByEmail.set(user.email, user);
  return res.status(201).json({ userId: user.id });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body as Partial<User>;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = usersByEmail.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
    expiresIn: "2h"
  });
  return res.status(200).json({ token });
});

app.get("/products", (_req, res) => {
  return res.status(200).json(products);
});

app.post("/carts", requireAuth, (req, res) => {
  const user = res.locals.user as AuthPayload;
  const cart: Cart = {
    id: generateId("cart"),
    userId: user.userId,
    items: []
  };
  carts.set(cart.id, cart);
  return res.status(201).json(cart);
});

app.post("/carts/:cartId/items", requireAuth, (req, res) => {
  const user = res.locals.user as AuthPayload;
  const { cartId } = req.params;
  const { productId, quantity } = req.body as Partial<CartItem>;

  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({ error: "productId and quantity are required" });
  }

  const cart = carts.get(cartId);
  if (!cart || cart.userId !== user.userId) {
    return res.status(404).json({ error: "Cart not found" });
  }

  const productExists = products.some((product) => product.id === productId);
  if (!productExists) {
    return res.status(404).json({ error: "Product not found" });
  }

  const existing = cart.items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }

  return res.status(200).json(cart);
});

app.post("/orders", requireAuth, (req, res) => {
  const user = res.locals.user as AuthPayload;
  const { cartId } = req.body as { cartId?: string };
  if (!cartId) {
    return res.status(400).json({ error: "cartId is required" });
  }

  const cart = carts.get(cartId);
  if (!cart || cart.userId !== user.userId) {
    return res.status(404).json({ error: "Cart not found" });
  }

  if (cart.items.length === 0) {
    return res.status(409).json({ error: "Cart is empty" });
  }

  const total = calculateTotal(cart.items, products);
  const order: Order = {
    id: generateId("ord"),
    userId: user.userId,
    items: cart.items,
    total
  };
  orders.set(order.id, order);
  return res.status(201).json(order);
});

app.get("/orders/:orderId", requireAuth, (req, res) => {
  const user = res.locals.user as AuthPayload;
  const { orderId } = req.params;
  const order = orders.get(orderId);
  if (!order || order.userId !== user.userId) {
    return res.status(404).json({ error: "Order not found" });
  }

  return res.status(200).json(order);
});

app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`REST mini e-commerce running on http://localhost:${port}`);
});
