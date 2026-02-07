# StrawBerry Method (Pipeline)

StrawBerry takes a WSDL interface and produces a behavior protocol automaton. The method is organized in five activities.

## 1) Dependencies elicitation

- Flatten the WSDL to make the structure of I/O messages explicit.
- Identify syntactic matches: an output parameter type of operation A matches an input parameter type of operation B.
- Each match yields an I/O dependency (initially uncertain).
- Optional heuristics can promote or prune dependencies:
  - Complex type dependencies are likely true.
  - Same name + same type suggests a true dependency.
  - Error outputs (e.g., errmsg) should not be matched.

## 2) Dependencies automaton synthesis

- Build a node for each operation with at least one dependency.
- Nodes store the dependencies for that operation.
- Directed arcs represent dependencies from source operations to sink operations.

## 3) Saturation

- Add a special Env node to model data provided directly by the client.
- Add dependencies from Env to any operation input type.

## 4) Testing-based refinement

Goal: validate or prune dependencies by testing the real service.

- Positive tests: use outputs from source operations as inputs to sink operations. If an error is returned, remove the dependency.
- Negative tests: supply random inputs of the expected type. If an error is returned, the dependency is confirmed.
- Remaining uncertain dependencies are conservatively removed.

The oracle is partially defined: since semantics of errors are unknown, the paper proposes a generic statistical approach to classify responses as regular or error (not fully implemented in the paper).

## 5) Behavior protocol synthesis

- Transform the validated data-flow dependencies into a control-flow automaton.
- States represent execution states.
- Transitions are labeled with operation calls and I/O data.

The resulting automaton captures valid invocation orderings and required data flows.
