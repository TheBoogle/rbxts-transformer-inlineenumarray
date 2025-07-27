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
	ts.sys.write("[EnumArrayTransformer] Running\n");

	const { factory, program } = context;

	// Match $enumarray<MyEnum>()
	if (
		ts.isCallExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === "$enumarray" &&
		node.typeArguments?.length === 1
	) {
		const TypeArg = node.typeArguments[0];
		if (!ts.isTypeReferenceNode(TypeArg)) return node;

		const TypeName = TypeArg.typeName;
		if (!ts.isIdentifier(TypeName)) return node;

		const Checker = program.getTypeChecker();
		const EnumSymbol = Checker.getSymbolAtLocation(TypeName);
		if (!EnumSymbol || !EnumSymbol.declarations) return node;

		const Declaration = EnumSymbol.declarations.find(ts.isEnumDeclaration);
		if (!Declaration) return node;

		const Elements: ts.Expression[] = [];

		for (const Member of Declaration.members) {
			if (!ts.isIdentifier(Member.name)) continue;

			const EnumAccess = factory.createPropertyAccessExpression(TypeName, Member.name);
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
