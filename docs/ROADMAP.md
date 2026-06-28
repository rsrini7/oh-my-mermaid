# Roadmap

## In Progress

### PlantUML Diagram Support
Add PlantUML rendering for sequence diagrams and C4 architecture models.
- Format detection (`.puml`, `.plantuml` extensions)
- Kroki proxy for online rendering
- Local `plantuml.jar` support for offline/air-gapped use
- C4 templates for enterprise architecture docs
- See [multi-format-diagram-support-plan.md](./multi-format-diagram-support-plan.md)

## Planned

### AI-powered search in viewer
Natural language search across architecture docs — "where does auth happen?" finds relevant elements across perspectives.

### Nested documentation boundaries
`.omm-boundary.yaml` for monorepo subtree delegation — each team owns their own .omm/ subtree.

### Schema validation
JSON Schema for `meta.yaml` validation — formal contract for external tools and CI.

## Future Scope

### Graphviz/DOT Support
Dependency graph rendering with advanced layouts (fdp, neato, circo, osage) for large codebases with 100+ modules.
- Client-side rendering via `@hpcc-js/wasm` (offline-capable)
- Better subgraph clustering than Mermaid
- `--format dot` option for `omm analyze`

### D2 Diagram Support
Modern diagramming language with grid layouts, icons, and SQL table support.
- Requires local `d2` binary or Kroki proxy
