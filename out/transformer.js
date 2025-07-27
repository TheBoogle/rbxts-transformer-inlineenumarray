"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformContext = void 0;
exports.default = Transformer;
var typescript_1 = __importDefault(require("typescript"));
var TransformContext = /** @class */ (function () {
    function TransformContext(program, context, config) {
        this.program = program;
        this.context = context;
        this.config = config;
        this.factory = context.factory;
    }
    TransformContext.prototype.transform = function (node) {
        var _this = this;
        return typescript_1.default.visitEachChild(node, function (child) { return VisitNode(_this, child); }, this.context);
    };
    return TransformContext;
}());
exports.TransformContext = TransformContext;
function VisitExpression(context, node) {
    var e_1, _a;
    var _b;
    typescript_1.default.sys.write("[EnumArrayTransformer] Running\n");
    var factory = context.factory, program = context.program;
    // Match $enumarray<MyEnum>()
    if (typescript_1.default.isCallExpression(node) &&
        typescript_1.default.isIdentifier(node.expression) &&
        node.expression.text === "$enumarray" &&
        ((_b = node.typeArguments) === null || _b === void 0 ? void 0 : _b.length) === 1) {
        var TypeArg = node.typeArguments[0];
        if (!typescript_1.default.isTypeReferenceNode(TypeArg))
            return node;
        var TypeName = TypeArg.typeName;
        if (!typescript_1.default.isIdentifier(TypeName))
            return node;
        var Checker = program.getTypeChecker();
        var EnumSymbol = Checker.getSymbolAtLocation(TypeName);
        if (!EnumSymbol || !EnumSymbol.declarations)
            return node;
        var Declaration = EnumSymbol.declarations.find(typescript_1.default.isEnumDeclaration);
        if (!Declaration)
            return node;
        var Elements = [];
        try {
            for (var _c = __values(Declaration.members), _d = _c.next(); !_d.done; _d = _c.next()) {
                var Member = _d.value;
                if (!typescript_1.default.isIdentifier(Member.name))
                    continue;
                var EnumAccess = factory.createPropertyAccessExpression(TypeName, Member.name);
                Elements.push(EnumAccess);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return factory.createArrayLiteralExpression(Elements, false);
    }
    return context.transform(node);
}
function VisitNode(context, node) {
    if (typescript_1.default.isExpression(node)) {
        return VisitExpression(context, node);
    }
    return context.transform(node);
}
function Transformer(program, config) {
    return function (context) {
        var transformContext = new TransformContext(program, context, config);
        return function (file) {
            var result = transformContext.transform(file);
            return typescript_1.default.factory.updateSourceFile(result, __spreadArray([], __read(result.statements), false), true);
        };
    };
}
