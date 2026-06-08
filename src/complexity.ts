import * as ts from "typescript";

export function estimateComplexity(type: ts.Type, checker: ts.TypeChecker, maxProperties: number): number {
  const seen = new Set<number>();
  const visit = (current: ts.Type, depth: number): number => {
    if (depth > 8) {
      return 2;
    }
    if (isPrimitiveLike(current)) {
      return 1;
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

function isPrimitiveLike(type: ts.Type): boolean {
  const primitiveFlags =
    ts.TypeFlags.StringLike |
    ts.TypeFlags.NumberLike |
    ts.TypeFlags.BooleanLike |
    ts.TypeFlags.BigIntLike |
    ts.TypeFlags.ESSymbolLike |
    ts.TypeFlags.Null |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Void |
    ts.TypeFlags.Never;
  return (type.flags & primitiveFlags) !== 0;
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
