# Frontend development rules

- Follow docs/MODULAR_REFACTOR_PLAN.md. The user's later instruction explicitly authorizes using and refactoring the copied Clawbox frontend; earlier prohibitions are superseded.
- Core contains only generic infrastructure. App is the composition root. Functional UI and services belong to modules.
- Declare module dependencies; consume another module only through its public entry or an injected contract. Do not bypass ownership via relative imports into another module's internals.
- Register settings/navigation/UI contributions; do not add feature-name switch statements to shared renderers.
- Resolve icons/fonts/themes through resources. Keep system, module and user ownership distinct.
- Reuse shared UI primitives: interactive surfaces are borderless with hover feedback; panel surfaces retain their border/background on hover. Input focus and child button states are independent.
- Preserve existing frontend functionality, persisted data and wire contracts during this refactor. Do not silently remove tools, skills or migration UI.
- No subagents are required. Validate changes with relevant tests, then full regression for architecture-wide edits.
