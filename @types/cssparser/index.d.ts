declare module 'cssparser/lib/cssparser' {
	export interface Rule {
		type: 'rule';
		selectors: string[];
		declarations: {
			[name: string]: string;
		};
	}

	export interface SimpleStylesheet {
		type: 'stylesheet';
		level: 'simple';
		value: Rule[];
	}

	export class AST {
		public toJSON(format: 'simple'): SimpleStylesheet;
	}

	export class Parser {
		public parse(css: string): AST;
	}
}
