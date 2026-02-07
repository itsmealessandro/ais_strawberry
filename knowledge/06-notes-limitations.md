# Notes, Limitations, and Open Points

## Assumptions and constraints

- Works best when session state is explicit in WSDL I/O parameters.
- Relies on syntactic type matching; may produce many false positives.
- Requires access to the running service for testing refinement.

## Testing oracle limits

- The oracle in the paper is partial and generic (regular vs error responses).
- It does not fully interpret semantics of errors, which can reduce precision.

## Heuristics dependency

- Heuristics can significantly reduce test effort but are not guaranteed.
- Some services might not follow naming or typing conventions, reducing heuristic effectiveness.

## Coverage and uncertainty

- Remaining uncertain dependencies are removed conservatively.
- This favors safety (avoid false dependencies) at the cost of potentially losing valid dependencies.

## Future work suggested by the paper

- Improve the oracle using semantic knowledge or statistics.
- Optimize the testing procedure for computational efficiency.
- Extend evaluation on more services and contexts.
