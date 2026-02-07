# StrawBerry Paper Overview

This document summarizes my understanding of the paper "Automatic Synthesis of Behavior Protocols for Composable Web-Services" (Bertolino, Inverardi, Pelliccione, Tivoli, 2009).

## Core idea

The paper proposes StrawBerry, a black-box method that derives a behavior protocol for a web service using only its WSDL interface. The behavior protocol is modeled as an automaton that captures valid client-side interaction sequences and the data passed between operations.

## Motivation

Most automatic composition approaches assume that, in addition to WSDL, a provider supplies a behavioral protocol. In practice this is rarely available. StrawBerry fills this gap by synthesizing a protocol from the signature and refining it through testing.

## Key contributions

- A synthesis method that infers data dependencies among operations by analyzing WSDL I/O types.
- A testing-based refinement phase that validates and prunes false dependencies.
- A transformation from a data-flow dependency model into a control-flow behavior protocol automaton.
- A practical case study on the Amazon E-Commerce Service (AECS).

## Output

The output is a behavior protocol automaton that specifies which operations can be invoked, in what order, and with what data dependencies, enabling automated service composition (e.g., for BPEL orchestration).
