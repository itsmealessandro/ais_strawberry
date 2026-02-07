# Problem Context and Assumptions

## Problem addressed

Automatic web-service composition needs behavioral information describing how a client should interact with a service. Most literature assumes this protocol is provided alongside the WSDL, but in practice it is missing. The paper tackles the question: how to infer a behavior protocol from WSDL alone.

## Behavioral protocol notion

The behavior protocol is the expected client-side interaction model. It describes valid sequences of operation calls and the data that must flow between them. This protocol is crucial for building composite services.

## Session handling assumption

The paper focuses on services that encode session state as explicit input/output data in the WSDL ("technique iv"). This is common in services like Amazon's AECS, and it is the only approach compatible with BPEL orchestration, because BPEL cannot use hidden session mechanisms (cookies, WS-ReliableMessaging, framework-specific APIs).

## Method characteristics

- Black-box: the method only needs the WSDL and does not inspect implementation code.
- Extra-procedural: it models interaction among operations (client-to-service), not the internal logic of single operations.

## Intended use

The derived behavior protocol is intended to support automatic composition and orchestration. The paper positions StrawBerry as a design-time tool for BPEL process architects.
