import ts from "typescript";

export interface TransformerConfig {
	_: void;
}

export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (child) => VisitNode(this, child), this.context);
	}
}

function VisitExpression(context: TransformContext, node: ts.Expression): ts.Expression {
	const { factory, program } = context;

	// Match $enumarray<MyEnum>()
	if (
		ts.isCallExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === "$enumarray" &&
		node.typeArguments?.length === 1
	) {
		// ts.sys.write(`[EnumArrayTransformer] Matched call: $enumarray<...>\n`);

		const TypeArg = node.typeArguments[0];

		let EnumIdent: ts.Identifier | undefined;

		if (ts.isTypeReferenceNode(TypeArg) && ts.isIdentifier(TypeArg.typeName)) {
			EnumIdent = TypeArg.typeName;
		} else if (ts.isTypeQueryNode(TypeArg) && ts.isIdentifier(TypeArg.exprName)) {
			EnumIdent = TypeArg.exprName;
		} else {
			ts.sys.write(
				`[EnumArrayTransformer] Skipped: unsupported type argument node kind (${
					ts.SyntaxKind[TypeArg.kind]
				})\n`,
			);
			return node;
		}

		const TypeNameText = EnumIdent.getText();

		const Checker = program.getTypeChecker();
		const EnumSymbol = Checker.getSymbolAtLocation(EnumIdent);

		if (!EnumSymbol) {
			ts.sys.write(`[EnumArrayTransformer] Skipped: could not resolve symbol for '${TypeNameText}'\n`);
			return node;
		}

		if (!EnumSymbol.declarations || EnumSymbol.declarations.length === 0) {
			ts.sys.write(`[EnumArrayTransformer] Skipped: no declarations found for symbol '${TypeNameText}'\n`);
			return node;
		}

		const Declaration = EnumSymbol.declarations.find(ts.isEnumDeclaration);
		if (!Declaration) {
			const DeclKinds = EnumSymbol.declarations.map((d) => ts.SyntaxKind[d.kind]).join(", ");
			ts.sys.write(
				`[EnumArrayTransformer] Skipped: no EnumDeclaration found in symbol '${TypeNameText}' (found: ${DeclKinds})\n`,
			);
			return node;
		}

		// ts.sys.write(`[EnumArrayTransformer] Replacing $enumarray<${TypeNameText}> with array literal\n`);

		const Elements: ts.Expression[] = [];

		for (const Member of Declaration.members) {
			const MemberName = Member.name.getText();
			if (!ts.isIdentifier(Member.name)) {
				// ts.sys.write(`[EnumArrayTransformer] Skipped member '${MemberName}' (not an Identifier)\n`);
				continue;
			}

			// ts.sys.write(`[EnumArrayTransformer] Adding member: ${TypeNameText}.${MemberName}\n`);
			const EnumAccess = factory.createPropertyAccessExpression(EnumIdent, Member.name);
			Elements.push(EnumAccess);
		}

		return factory.createArrayLiteralExpression(Elements, false);
	}

	return context.transform(node);
}

function VisitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (ts.isExpression(node)) {
		return VisitExpression(context, node);
	}

	return context.transform(node);
}

export default function Transformer(
	program: ts.Program,
	config: TransformerConfig,
): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		const transformContext = new TransformContext(program, context, config);
		return (file: ts.SourceFile) => {
			const result = transformContext.transform(file);
			return ts.factory.updateSourceFile(result, [...result.statements], true);
		};
	};
}
