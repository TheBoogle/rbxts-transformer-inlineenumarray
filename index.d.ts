export declare function $enumarray<T extends Record<string, string | number>>(): readonly T[keyof T][];

export declare function $enumdictionary<T extends Record<string, string | number>>(): readonly {
	[K in keyof T]: T[K];
};
