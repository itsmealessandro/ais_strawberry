export type User = {
  id: string;
  email: string;
  password: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type Cart = {
  id: string;
  userId: string;
  items: CartItem[];
};

export type Order = {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
};

export type AuthPayload = {
  userId: string;
  email: string;
};
