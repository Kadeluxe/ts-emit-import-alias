import * as ts from "typescript";
import {CustomTransformers} from "typescript";
import {PathResolver} from "./PathResolver";

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && node.expression.kind == ts.SyntaxKind.ImportKeyword;
}

function getImportSpecifier(sf: ts.SourceFile, node: ts.Node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return (node.moduleSpecifier as ts.StringLiteral).getText(sf).slice(1, -1);
  }

  if (isDynamicImport(node)) {
    return node.arguments[0].getText(sf).slice(1, -1);
  }

  return undefined;
}

function replaceSpecifier(ctx: ts.TransformationContext, node: ts.Node, specifier: string) {
  if (ts.isImportDeclaration(node)) {
    return ctx.factory.updateImportDeclaration(
      node,
      node.decorators,
      node.modifiers,
      node.importClause,
      ctx.factory.createStringLiteral(specifier),
      node.assertClause
    );
  }

  if (ts.isExportDeclaration(node)) {
    return ctx.factory.updateExportDeclaration(
      node,
      node.decorators,
      node.modifiers,
      node.isTypeOnly,
      node.exportClause,
      ctx.factory.createStringLiteral(specifier),
      node.assertClause
    );
  }

  if (isDynamicImport(node)) {
    return ctx.factory.updateCallExpression(
      node,
      node.expression,
      node.typeArguments,
      ctx.factory.createNodeArray([
        ctx.factory.createStringLiteral(specifier),
      ])
    );
  }
}

function createVisitor(sf: ts.SourceFile, ctx: ts.TransformationContext, pathMatcher?: PathResolver) {
  const visitor = (node: ts.Node): ts.Node => {
    const next = () => ts.visitEachChild(node, visitor, ctx);

    const specifier = getImportSpecifier(sf, node);
    if (!specifier) return next();

    const resolved = pathMatcher?.resolve(sf.fileName, specifier);
    if (!resolved) return next();

    const newNode = replaceSpecifier(ctx, node, resolved);

    return newNode ?? next();
  };

  return visitor;
}

function createTransformer(compilerOptions: ts.CompilerOptions) {
  let pathMatcher: PathResolver | undefined;

  if (compilerOptions.paths) {
    pathMatcher = new PathResolver(compilerOptions.baseUrl!, compilerOptions.paths);
  }

  return (ctx: ts.TransformationContext) => {
    return (sf: ts.SourceFile | ts.Bundle) => {
      if (pathMatcher === undefined || ts.isBundle(sf)) return sf;

      const visitor = createVisitor(sf, ctx, pathMatcher);
      return ts.visitEachChild(sf, visitor, ctx);
    };
  };

}

export function transformer(program: ts.Program): CustomTransformers {
  const transformer = createTransformer(program.getCompilerOptions());

  return {
    after: [transformer as ts.TransformerFactory<ts.SourceFile>],
    afterDeclarations: [transformer as ts.TransformerFactory<ts.SourceFile | ts.Bundle>],
  };
}
