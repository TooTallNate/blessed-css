import blessed from 'blessed';

export type Styles = {
	[name: string]: string | boolean | Styles;
};

export function isStyles(v: any): v is Styles {
	return v && typeof v === 'object';
}

interface PseudoStyles {
	[type: string]: string[];
}

// Property names to map to HTML attributes when serializing as HTML
const attrProps: string[] = ['name', 'id', 'draggable', 'scrollable', 'shadow'];

const pseudoStyles: PseudoStyles = {
	element: ['border', 'label'],
	list: ['selected', 'item'],
	listbar: ['selected', 'item', 'prefix'],
	'progress-bar': ['bar'],
	'scrollable-box': ['track', 'scrollbar'],
	table: ['cell', 'header']
};

// "list-table" is both "list" and "table"
pseudoStyles['list-table'] = [...pseudoStyles.list, ...pseudoStyles.table];

export function parseClassName(
	className?: string | Iterable<string>
): string[] {
	let arr: string[] = [];
	if (className) {
		if (typeof className === 'string') {
			arr = className.split(/\s+/);
		} else {
			arr = Array.from(className);
		}
	}
	return arr.filter(Boolean);
}

export function parseBools(o: Styles): void {
	for (const k of Object.keys(o)) {
		const v = o[k];
		if (v === 'true') {
			o[k] = true;
		} else if (v === 'false') {
			o[k] = false;
		} else if (isStyles(v)) {
			parseBools(v);
		}
	}
}

export function getPseudoStyles(node: blessed.Widgets.Node): Set<string> {
	const props: string[] = [];
	let proto = Object.getPrototypeOf(node);
	while (proto && proto.type) {
		if (pseudoStyles[proto.type]) {
			props.push(...pseudoStyles[proto.type]);
		}
		proto = Object.getPrototypeOf(proto);
	}
	return new Set(props);
}

export function toHTML(
	node: blessed.Widgets.Node,
	selector = '',
	self = false,
	children = ''
): string {
	const name = node.type;
	const classNames = new Set([
		...parseClassName(node.options.className),
		...parseClassName(node.options.classNames),
		...selector
			.split(':')
			.filter(Boolean)
			.map(s => `__pseudo_${s}`)
	]);
	let attrs = '';
	if (classNames.size > 0) {
		attrs += ` class="${Array.from(classNames).join(' ')}"`;
	}
	for (const prop of attrProps) {
		// @ts-ignore
		const val = node[prop] || node.options[prop];
		if (typeof val === 'boolean') {
			if (val) {
				attrs += ` ${prop}`;
			}
		} else if (val != null) {
			attrs += ` ${prop}="${val}"`;
		}
	}
	if (self) {
		attrs += ' self';
	}
	const html = `<${name}${attrs}>${children}</${name}>`;
	if (node.parent) {
		return toHTML(node.parent, '', false, html);
	}
	return html;
}
