# REST Mini E-Commerce Service

This project is a minimal REST API designed to be analyzed by a StrawBerry-REST method. It provides a small, well-documented e-commerce flow with explicit data dependencies.

## Technology stack

- Node.js 22
- TypeScript
- Express (HTTP server)
- JSON Web Tokens (authentication)
- Swagger UI (OpenAPI 3.1 documentation)
- dotenv (configuration)

## Structure

- `src/` application source code
- `openapi.yaml` OpenAPI 3.1 specification (contract-first)
- `docs/` usage notes and examples

## Core flow

1. Register and login to obtain a JWT token.
2. List products (public endpoint).
3. Create a cart (token required).
4. Add items to the cart (token + cartId).
5. Place an order (token + cartId).
6. Retrieve the order (token + orderId).

## Data dependencies (expected)

- `token` returned by `/auth/login` is required by protected endpoints.
- `cartId` returned by `/carts` is required to add items and create orders.
- `orderId` returned by `/orders` is required to retrieve order details.
