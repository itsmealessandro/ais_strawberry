import type { Cart, Order, Product, User } from "./types.js";

export const users = new Map<string, User>();
export const usersByEmail = new Map<string, User>();
export const carts = new Map<string, Cart>();
export const orders = new Map<string, Order>();

export const products: Product[] = [
  { id: "prd_001", name: "Strawberry Notebook", price: 12.5 },
  { id: "prd_002", name: "Tivoli Pen", price: 3.99 },
  { id: "prd_003", name: "Protocol Mug", price: 9.5 }
];
