# StrawBerry-REST (Prototype)

This prototype implements the first stage of a StrawBerry-inspired method for REST APIs. It ingests an OpenAPI 3.1 specification and extracts candidate data dependencies among operations.

## Goals (v0)

- Parse OpenAPI specs (YAML/JSON).
- Resolve $ref schemas and flatten request/response shapes.
- Extract dependencies based on field name/type matches.
- Include REST-specific dependencies (path params, auth token).
- Build a dependency graph and emit a report (JSON + Markdown).

## Planned outputs

- `output/dependencies.json`
- `output/summary.md`

## Execution (planned)

```bash
npm install
npm run analyze -- --spec ../rest-mini-e-commerce/openapi.yaml
```
