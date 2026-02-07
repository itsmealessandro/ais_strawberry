import crypto from "crypto";
import type { CartItem, Product } from "./types.js";

export const generateId = (prefix: string) => {
  const suffix = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${suffix}`;
};

export const calculateTotal = (items: CartItem[], products: Product[]) => {
  const priceById = new Map(products.map((product) => [product.id, product.price]));
  return items.reduce((total, item) => {
    const price = priceById.get(item.productId) ?? 0;
    return total + price * item.quantity;
  }, 0);
};
