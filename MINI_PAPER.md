# StrawBerry-REST: Mini Paper

## Abstract

This work adapts the StrawBerry method from SOAP/WSDL to REST/OpenAPI. The goal is to infer inter-operation dependencies, validate them at runtime, and establish a basis for protocol synthesis. We implement a full pipeline that loads OpenAPI, normalizes schemas, extracts operations, infers dependencies with confidence scores, and validates them through an example-driven, multi-pass refinement runner. We report results on a minimal e-commerce API and on Swagger Petstore. The study shows that REST dependency inference is feasible, but full validation requires strict contract inputs and remains sensitive to hidden business rules.

## 1. Introduction

StrawBerry targets the automatic derivation of service protocols from interface contracts. The original method leverages SOAP/WSDL, where message structure and types are explicit. REST APIs, however, expose behavior through HTTP endpoints and JSON payloads, where many constraints are implicit. This work investigates whether a StrawBerry-like pipeline can be built for REST, how far static inference can go, and what is needed to validate dependencies at runtime without domain-specific knowledge.

## 2. Background and Motivation

SOAP/WSDL provides strong typing and explicit message definitions, often making dependencies between operations discoverable from the contract alone. REST/OpenAPI is less explicit: input fields are spread across body, path, query, header, and cookie parameters, and many constraints are only implied. The motivation is to close this gap with a generic pipeline that infers dependencies and then verifies them through execution against a live service.

## 3. Method Overview

We implement a pipeline that mirrors StrawBerry but is adapted to OpenAPI:

1) Load and validate the OpenAPI specification.
2) Resolve $ref and normalize schemas (allOf/oneOf/anyOf, discriminators).
3) Extract operations and flatten request/response shapes.
4) Infer dependencies using heuristics and confidence scores.
5) Refine dependencies via runtime execution and iterative verification.
6) Report results in JSON and Markdown.

The validation and refinement stages are critical for REST, since the contract alone is not enough to ensure correctness.

## 4. Implementation Summary

### 4.1 Static Analysis

The pipeline extracts operations from OpenAPI paths, including method, path, request body fields, response fields, and parameters (path/query/header/cookie). Schemas are flattened into dotted field paths. Dependencies are inferred by matching output fields to input fields across operations using deterministic heuristics:

- exact-name match
- token-based match
- entity-id match (e.g., cartId -> id of Cart)
- auth token propagation

Each dependency is assigned a confidence score and reported in `output/<app>-<timestamp>/dependencies.json` and `summary.md`.

### 4.2 Validation Gate

To remain generic and still executable, we require strict OpenAPI input examples. The validator blocks analysis/refinement if any endpoint lacks:

- request body example (when body exists)
- parameter examples for all parameters (required and optional)

Validation results are shown in console output and in `analysis.md`.

### 4.3 Generic Runtime Refinement

Refinement executes operations using examples, records responses, and replays operations using pooled outputs. The procedure runs in multiple iterations:

- Iteration 1: run all operations with example inputs.
- Iteration 2..N: fill inputs with pooled outputs and re-run.
- Stop when an iteration yields no successful operations and no new verified dependencies.

The system writes:

- `refinement-diff.md` for before/after changes
- `refinement-iterations.md` for per-iteration results

## 5. Evaluation

### 5.1 REST Mini E-Commerce

This API is designed as a controlled case study. It includes auth, cart, and order flows, and provides input examples in OpenAPI. The multi-pass refinement verified a majority of dependencies without any manual workflow definition.

Observed results (example run):

- Total dependencies: 8
- Verified after refinement: 5
- Verified dependencies include auth propagation and cartId chaining.

The remaining dependencies require stricter sequencing or more state-aware execution (e.g., ensuring the cart contains items before placing an order).

### 5.2 Swagger Petstore

Petstore is usable for static analysis, but runtime refinement is blocked due to missing examples on many endpoints. This highlights the requirement that OpenAPI must provide complete input examples if a generic execution strategy is expected to work.

## 6. Discussion

The results indicate that generic StrawBerry-REST is viable, but full validation depends on contract quality and runtime preconditions. Key constraints include:

- hidden business rules not expressed in OpenAPI
- stateful sequencing of operations
- coherence between input examples across endpoints

The multi-pass strategy improves coverage without domain knowledge, yet still cannot guarantee full verification for all dependencies. SOAP/WSDL remains more amenable to protocol derivation because of explicit message structure, but it also suffers from hidden business logic at runtime.

## 7. Conclusion

We demonstrated that StrawBerry-REST can infer dependencies from OpenAPI and validate a significant subset at runtime using only examples. The approach is generic and does not require links or hardcoded workflows. However, complete validation is not guaranteed without stronger contract requirements or additional execution guidance.

## 8. Future Work

- Pool-aware scheduling to only execute operations when required inputs are available.
- Multiple candidate selection per field to increase success rates.
- Stronger feedback loops to learn which inputs satisfy business constraints.
- Quantitative study of coverage versus spec quality (examples, response schemas).
