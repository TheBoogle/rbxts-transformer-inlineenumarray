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
		ts.sys.write("[EnumArrayTransformer] Matched $enumarray call\n");

		const TypeArg = node.typeArguments[0];
		if (!ts.isTypeReferenceNode(TypeArg)) {
			ts.sys.write("[EnumArrayTransformer] TypeArg is not a TypeReferenceNode\n");
			return node;
		}

		const TypeName = TypeArg.typeName;
		if (!ts.isIdentifier(TypeName)) {
			ts.sys.write("[EnumArrayTransformer] TypeName is not an Identifier\n");
			return node;
		}

		const Checker = program.getTypeChecker();
		const EnumSymbol = Checker.getSymbolAtLocation(TypeName);
		if (!EnumSymbol) {
			ts.sys.write(`[EnumArrayTransformer] Could not resolve symbol for type '${TypeName.getText()}'\n`);
			return node;
		}

		if (!EnumSymbol.declarations || EnumSymbol.declarations.length === 0) {
			ts.sys.write(`[EnumArrayTransformer] Symbol for '${TypeName.getText()}' has no declarations\n`);
			return node;
		}

		const Declaration = EnumSymbol.declarations.find(ts.isEnumDeclaration);
		if (!Declaration) {
			ts.sys.write(`[EnumArrayTransformer] Declaration for '${TypeName.getText()}' is not an EnumDeclaration\n`);
			return node;
		}

		ts.sys.write(`[EnumArrayTransformer] Replacing $enumarray<${TypeName.getText()}> with literal array\n`);

		const Elements: ts.Expression[] = [];

		for (const Member of Declaration.members) {
			if (!ts.isIdentifier(Member.name)) {
				ts.sys.write(`[EnumArrayTransformer] Skipping non-Identifier member name: ${Member.name.getText()}\n`);
				continue;
			}

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
