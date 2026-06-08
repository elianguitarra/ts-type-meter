import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { estimateComplexity } from "../out/complexity.js";

function createProgram(sourceText) {
  const dir = join(tmpdir(), `ts-type-meter-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const fileName = join(dir, "fixture.ts");
  writeFileSync(fileName, sourceText);
  const program = ts.createProgram([fileName], {
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    strict: true,
    target: ts.ScriptTarget.ES2022
  });
  return { fileName, program };
}

function getAliasComplexity(sourceText, aliasName) {
  const { fileName, program } = createProgram(sourceText);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  let declaration;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === aliasName) {
      declaration = node;
    }
  });
  assert.ok(declaration, `missing alias ${aliasName}`);
  return estimateComplexity(checker.getTypeAtLocation(declaration), checker, 64);
}

test("scores object types above primitive literals", () => {
  const primitive = getAliasComplexity("type Primitive = 1;", "Primitive");
  const object = getAliasComplexity("type Objectish = { id: string; nested: { enabled: boolean; count: number } };", "Objectish");
  assert.ok(object > primitive, `expected object ${object} to exceed primitive ${primitive}`);
});

test("scores unions and nested generics above plain objects", () => {
  const source = `
    type Plain = { id: string; name: string };
    type Complex =
      | { ok: true; payload: Promise<Array<{ id: string; tags: Record<"a" | "b", boolean> }>> }
      | { ok: false; error: { code: number; message: string; causes?: string[] } };
  `;
  const plain = getAliasComplexity(source, "Plain");
  const complex = getAliasComplexity(source, "Complex");
  assert.ok(complex > plain, `expected complex ${complex} to exceed plain ${plain}`);
});
