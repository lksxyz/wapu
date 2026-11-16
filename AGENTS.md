# wapu — Agent Rules

Design as graphs. Every node carries three channels: content, failure, needs. Read the governing doc before designing in its domain — source: [gist](https://gist.github.com/r17x/90eb2f7be93932b5693753aedb09c01a).

- Backend / data-flow design (shapes, A/E/R, gen body = A, pipe = E) → [docs/design-thinking.md](docs/design-thinking.md)
- Interface / surface design (C/V/N, void states, needs on the edge) → [docs/design-graph.md](docs/design-graph.md)
- Multi-agent delegation (subgraph in, implemented graph out) → [docs/graph-protocol.md](docs/graph-protocol.md)

Core invariant: the code IS the graph. If the implementation doesn't match the call graph, the implementation is wrong.

## Call graph output

When showing call graphs, execution flows, or architecture traces, use this format:

Production:

```ts
HTTP handlers
  → ComponentA
    → ComponentA.layerX
      → ComponentB
        → ComponentC
```

Tests:

```ts
HTTP handlers
  → ComponentA
    → componentMemoryLayer
      → ComponentA.layer
        → ComponentB.layerMemory
```

- Plain text only, no rendered diagrams
- Indented `→` arrows for hierarchy
- `ts` code block
- Production and Tests as separate sections when they differ
- Include call graphs in project overviews, architecture summaries, and code explanations
