import * as path from "path";
import * as ts from "typescript";
import * as vscode from "vscode";

type Metric = {
  label: string;
  fileName: string;
  line: number;
  typeText: string;
  complexity: number;
  programMs: number;
  resolveMs: number;
  printMs: number;
  totalMs: number;
};

type AnalyzeTarget = {
  document: vscode.TextDocument;
  position: vscode.Position;
  range?: vscode.Range;
};

export function activate(context: vscode.ExtensionContext) {
  const analyzer = new TypeAnalyzer();
  const selector: vscode.DocumentSelector = [
    { language: "typescript", scheme: "file" },
    { language: "typescriptreact", scheme: "file" }
  ];

  context.subscriptions.push(
    vscode.commands.registerCommand("tsTypeMeter.analyzeSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const selection = editor.selection.isEmpty ? undefined : editor.selection;
      const metric = analyzer.analyze({
        document: editor.document,
        position: selection?.active ?? editor.selection.active,
        range: selection
      });
      await showMetric(metric);
    }),
    vscode.commands.registerCommand("tsTypeMeter.analyzeFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const metrics = analyzer.analyzeTopLevel(editor.document);
      const rows = metrics
        .map((m) => `${m.label}: complexity ${m.complexity}, ${m.totalMs.toFixed(2)}ms`)
        .join("\n");
      await vscode.window.showInformationMessage(
        metrics.length ? `TS Type Meter analyzed ${metrics.length} declarations.` : "No declarations found."
      );
      if (rows) {
        const doc = await vscode.workspace.openTextDocument({
          language: "plaintext",
          content: rows
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    }),
    vscode.languages.registerCodeLensProvider(selector, new TypeMeterCodeLensProvider(analyzer)),
    vscode.languages.registerHoverProvider(selector, new TypeMeterHoverProvider(analyzer))
  );
}

export function deactivate() {
  // No background resources.
}

class TypeAnalyzer {
  analyze(target: AnalyzeTarget): Metric {
    const totalStart = performance.now();
    const programStart = performance.now();
    const setup = createProgramForDocument(target.document);
    const programMs = performance.now() - programStart;
    const checker = setup.program.getTypeChecker();
    const sourceFile = setup.program.getSourceFile(target.document.fileName);
    if (!sourceFile) {
      throw new Error(`Unable to load source file: ${target.document.fileName}`);
    }

    const offset = target.document.offsetAt(target.position);
    const selected = target.range
      ? findNodeContainingRange(sourceFile, target.document.offsetAt(target.range.start), target.document.offsetAt(target.range.end))
      : findSmallestNodeAt(sourceFile, offset);
    const node = selected ?? sourceFile;

    const resolveStart = performance.now();
    const type = checker.getTypeAtLocation(node);
    const resolveMs = performance.now() - resolveStart;

    const printStart = performance.now();
    const typeText = checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias);
    const printMs = performance.now() - printStart;

    const config = vscode.workspace.getConfiguration("tsTypeMeter");
    const complexity = estimateComplexity(type, checker, config.get<number>("maxProperties", 64));
    const label = getNodeLabel(node, checker);

    return {
      label,
      fileName: target.document.fileName,
      line: target.position.line + 1,
      typeText,
      complexity,
      programMs,
      resolveMs,
      printMs,
      totalMs: performance.now() - totalStart
    };
  }

  analyzeTopLevel(document: vscode.TextDocument): Metric[] {
    const sourceFile = ts.createSourceFile(document.fileName, document.getText(), ts.ScriptTarget.Latest, true);
    const declarations = collectTopLevelDeclarations(sourceFile);
    return declarations.slice(0, 100).map((node) => {
      const position = document.positionAt(node.getStart(sourceFile));
      return this.analyze({ document, position });
    });
  }
}

class TypeMeterCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly analyzer: TypeAnalyzer) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration("tsTypeMeter");
    if (!config.get<boolean>("enableCodeLens", true)) {
      return [];
    }

    const sourceFile = ts.createSourceFile(document.fileName, document.getText(), ts.ScriptTarget.Latest, true);
    return collectTopLevelDeclarations(sourceFile).slice(0, 50).map((node) => {
      const position = document.positionAt(node.getStart(sourceFile));
      let title = "TS Type Meter";
      try {
        const metric = this.analyzer.analyze({ document, position });
        title = `Type complexity ${metric.complexity} | load ${metric.totalMs.toFixed(1)}ms`;
      } catch {
        title = "TS Type Meter: analyze";
      }

      return new vscode.CodeLens(new vscode.Range(position, position), {
        title,
        command: "tsTypeMeter.analyzeSelection"
      });
    });
  }
}

class TypeMeterHoverProvider implements vscode.HoverProvider {
  constructor(private readonly analyzer: TypeAnalyzer) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const config = vscode.workspace.getConfiguration("tsTypeMeter");
    if (!config.get<boolean>("enableHover", true)) {
      return undefined;
    }

    try {
      const metric = this.analyzer.analyze({ document, position });
      const md = new vscode.MarkdownString();
      md.appendMarkdown("**TS Type Meter**\n\n");
      md.appendMarkdown(`- Complexity: \`${metric.complexity}\`\n`);
      md.appendMarkdown(`- Total load: \`${metric.totalMs.toFixed(2)}ms\`\n`);
      md.appendMarkdown(`- Program: \`${metric.programMs.toFixed(2)}ms\`, resolve: \`${metric.resolveMs.toFixed(2)}ms\`, print: \`${metric.printMs.toFixed(2)}ms\`\n\n`);
      md.appendCodeblock(metric.typeText.slice(0, 4000), "typescript");
      return new vscode.Hover(md);
    } catch {
      return undefined;
    }
  }
}

async function showMetric(metric: Metric) {
  const content = [
    `TS Type Meter report`,
    ``,
    `Target: ${metric.label}`,
    `File: ${metric.fileName}:${metric.line}`,
    `Complexity: ${metric.complexity}`,
    `Total load: ${metric.totalMs.toFixed(2)}ms`,
    `Program build: ${metric.programMs.toFixed(2)}ms`,
    `Type resolve: ${metric.resolveMs.toFixed(2)}ms`,
    `Type print: ${metric.printMs.toFixed(2)}ms`,
    ``,
    `Resolved type:`,
    metric.typeText
  ].join("\n");

  const doc = await vscode.workspace.openTextDocument({ language: "typescript", content });
  await vscode.window.showTextDocument(doc, { preview: true });
}

function createProgramForDocument(document: vscode.TextDocument) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder?.uri.fsPath ?? path.dirname(document.fileName);
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");
  const host = ts.createCompilerHost({}, true);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const documentText = document.getText();
  const normalizedDocument = path.normalize(document.fileName);

  host.readFile = (fileName) => {
    if (path.normalize(fileName) === normalizedDocument) {
      return documentText;
    }
    return originalReadFile(fileName);
  };

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path.normalize(fileName) === normalizedDocument) {
      return ts.createSourceFile(fileName, documentText, languageVersion, true);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
    const rootNames = parsed.fileNames.includes(document.fileName) ? parsed.fileNames : [...parsed.fileNames, document.fileName];
    return {
      program: ts.createProgram(rootNames, parsed.options, host)
    };
  }

  return {
    program: ts.createProgram([document.fileName], {
      allowJs: document.languageId === "javascript",
      jsx: document.languageId === "typescriptreact" ? ts.JsxEmit.React : ts.JsxEmit.Preserve,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: false,
      target: ts.ScriptTarget.ES2022
    }, host)
  };
}

function collectTopLevelDeclarations(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      nodes.push(statement);
    }
    if (ts.isVariableStatement(statement)) {
      nodes.push(...statement.declarationList.declarations);
    }
  }
  return nodes;
}

function findSmallestNodeAt(root: ts.Node, offset: number): ts.Node | undefined {
  let best: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (node.getFullStart() <= offset && offset <= node.getEnd()) {
      best = node;
      ts.forEachChild(node, visit);
    }
  };
  visit(root);
  return best;
}

function findNodeContainingRange(root: ts.Node, start: number, end: number): ts.Node | undefined {
  let best: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (node.getFullStart() <= start && end <= node.getEnd()) {
      best = node;
      ts.forEachChild(node, visit);
    }
  };
  visit(root);
  return best;
}

function getNodeLabel(node: ts.Node, checker: ts.TypeChecker): string {
  const symbol = checker.getSymbolAtLocation(node) ?? ("name" in node && ts.isIdentifier((node as { name?: ts.Node }).name as ts.Node) ? checker.getSymbolAtLocation((node as { name: ts.Identifier }).name) : undefined);
  if (symbol?.getName()) {
    return symbol.getName();
  }
  return ts.SyntaxKind[node.kind] ?? "node";
}

function estimateComplexity(type: ts.Type, checker: ts.TypeChecker, maxProperties: number): number {
  const seen = new Set<number>();
  const visit = (current: ts.Type, depth: number): number => {
    if (depth > 8) {
      return 2;
    }
    const id = (current as ts.Type & { id?: number }).id;
    if (id !== undefined) {
      if (seen.has(id)) {
        return 1;
      }
      seen.add(id);
    }

    let score = 1;
    if (current.isUnion()) {
      score += 4 + current.types.reduce((sum, child) => sum + visit(child, depth + 1), 0);
    }
    if (current.isIntersection()) {
      score += 5 + current.types.reduce((sum, child) => sum + visit(child, depth + 1), 0);
    }

    const typeArguments = getTypeArguments(current, checker);
    score += typeArguments.length * 2;
    for (const arg of typeArguments) {
      score += visit(arg, depth + 1);
    }

    const callSignatures = current.getCallSignatures();
    const constructSignatures = current.getConstructSignatures();
    score += (callSignatures.length + constructSignatures.length) * 7;

    const properties = checker.getPropertiesOfType(current).slice(0, maxProperties);
    score += properties.length;
    for (const prop of properties) {
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (declaration) {
        try {
          score += Math.min(12, visit(checker.getTypeOfSymbolAtLocation(prop, declaration), depth + 1));
        } catch {
          score += 1;
        }
      }
    }

    if (properties.length === maxProperties) {
      score += 25;
    }
    return score;
  };

  return visit(type, 0);
}

function getTypeArguments(type: ts.Type, checker: ts.TypeChecker): readonly ts.Type[] {
  if ("typeArguments" in type && Array.isArray((type as { typeArguments?: ts.Type[] }).typeArguments)) {
    return (type as { typeArguments: ts.Type[] }).typeArguments;
  }
  if ((type.flags & ts.TypeFlags.Object) !== 0) {
    try {
      return checker.getTypeArguments(type as ts.TypeReference);
    } catch {
      return [];
    }
  }
  return [];
}
