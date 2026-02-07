# Method Formalization (Key Definitions)

The paper provides a formal definition of the method. This file captures the main concepts.

## I/O dependencies

Dependencies are defined by matching output types to input types. They are split into certain and uncertain sets. Dependencies can also originate from the environment (client-provided data).

## Dependencies automaton

- Nodes correspond to operations with dependencies.
- Each node stores the dependencies of its operation.
- Directed edges reflect dependency relations between operations.

## Saturation

The automaton is saturated by adding a special Env node that models any input parameter as directly provided by the client. This adds arcs from Env to all relevant operations.

## Dependency chains

A dependency chain is a path starting from Env through dependency arcs. These chains drive test generation and refinement.

## Validation by testing

The validated dependency automaton contains only certain dependencies. Uncertain dependencies are confirmed or removed via the testing procedure described in the paper (positive and negative tests).

## Behavior protocol automaton

The final protocol automaton is synthesized by:

- Building connected components of independent operations.
- Creating states and transitions for all legal interleavings.
- Labeling transitions with operation calls and I/O data.

This automaton encodes the client-side interaction protocol.
