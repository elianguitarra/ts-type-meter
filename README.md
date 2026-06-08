# TS Type Meter

[![CI](https://github.com/elianguitarra/ts-type-meter/actions/workflows/ci.yml/badge.svg)](https://github.com/elianguitarra/ts-type-meter/actions/workflows/ci.yml)

TS Type Meter is a VS Code extension that estimates how expensive a TypeScript type is to resolve and display.

It adds:

- CodeLens entries above exported declarations with a type complexity score and timing.
- Hover diagnostics for the symbol under the cursor.
- Commands to analyze the current selection or the active TypeScript file.
- A structured report that separates program build time, checker lookup time, and type stringification time.
- Cached measurements keyed by document URI, version, cursor offset, and selected range.
- A built-in benchmark command using a pathological TypeScript fixture.
- Automated tests for the structural complexity scorer.

This project was built for the TSPerf Grand Challenge: a MIT-licensed VS Code plugin that helps developers see type complexity and the time needed to load a type.

## Commands

- `TS Type Meter: Analyze Selection`
- `TS Type Meter: Analyze Active File`
- `TS Type Meter: Run Built-in Benchmark`

## Metrics

The extension reports:

- `complexity`: a deterministic estimate based on unions, intersections, properties, signatures, tuple/object members, and nested generic arguments.
- `programMs`: time to create the TypeScript program for the workspace/file.
- `resolveMs`: time to resolve the selected node's TypeScript type.
- `printMs`: time to stringify the resolved type through the TypeScript checker.
- `totalMs`: end-to-end analysis time.

The score is intended for comparing types within a project. It is not a formal TypeScript compiler cost model.

## Development

```powershell
npm install
npm run compile
npm test
```

Then open this folder in VS Code and run the extension host.

To package an installable VSIX:

```powershell
npx vsce package --no-dependencies --allow-star-activation
```

## License

MIT
