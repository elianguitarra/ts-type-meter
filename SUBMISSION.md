# TSPerf Grand Challenge Submission

Submission for: <https://algora.io/challenges/tsperf>

Repository: <https://github.com/elianguitarra/ts-type-meter>

Evidence release: <https://github.com/elianguitarra/ts-type-meter/releases/tag/evidence-ts-type-meter-refresh214>

## Summary

TS Type Meter is a MIT-licensed VS Code extension that surfaces TypeScript type complexity and type load timing directly inside the editor.

It implements:

- CodeLens metrics above top-level TypeScript declarations.
- Hover reports for symbols under the cursor.
- `TS Type Meter: Analyze Selection`.
- `TS Type Meter: Analyze Active File`.
- `TS Type Meter: Run Built-in Benchmark`.
- TypeScript compiler API timing split into program build, checker resolution, and type stringification.
- Deterministic structural complexity scoring for unions, intersections, generics, properties, signatures, and nested object shapes.
- Cached measurements keyed by document URI, version, offset, selected range, and scoring settings.
- A pathological fixture for comparing recursive/conditional/mapped types.
- Automated `node:test` coverage for the structural complexity scorer.
- GitHub Actions CI that installs dependencies, compiles, runs tests, packages the VSIX, and uploads the VSIX as a workflow artifact.

## Validation

Validated locally on Windows:

```powershell
node node_modules/typescript/bin/tsc -p .
vsce package --no-dependencies --allow-star-activation
```

Generated artifact:

```text
ts-type-meter-0.1.3.vsix
```

## Payout

Preferred payout: USDC on Base/EVM to:

```text
0x237664403f52A15142795f807ADB3524E8057909
```
