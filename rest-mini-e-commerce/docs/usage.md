# Usage

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run dev
```

## OpenAPI Docs

Open http://localhost:3000/docs

## Example flow (curl)

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123!"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123!"}'

curl http://localhost:3000/products

curl -X POST http://localhost:3000/carts \
  -H "Authorization: Bearer <TOKEN>"

curl -X POST http://localhost:3000/carts/<CART_ID>/items \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prd_001","quantity":2}'

curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"cartId":"<CART_ID>"}'

curl http://localhost:3000/orders/<ORDER_ID> \
  -H "Authorization: Bearer <TOKEN>"
```
