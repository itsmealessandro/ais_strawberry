# Case Study: Amazon E-Commerce Service (AECS)

The paper evaluates StrawBerry on the Amazon E-Commerce Service (AECS), a large and widely used web service suite.

## Setup

- Input: AECS WSDL with 23 operations.
- StrawBerry derives a large number of raw dependencies from type matches.

## Results (high level)

- Initial discovery yields a very large dependency set (hundreds of thousands).
- Heuristics 1 and 2 promote a subset of dependencies to certain.
- Heuristic 3 removes dependencies involving error outputs.
- Testing refines the remaining uncertain dependencies to zero.

## Takeaways

- The method scales to a real, complex WSDL.
- Heuristics reduce testing cost by pruning or confirming many dependencies early.
- The final behavior protocol can be obtained even for large services, though the dependency automaton itself is too large to visualize directly.
