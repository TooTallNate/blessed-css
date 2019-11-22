import blessed from 'blessed';
import createDebug from 'debug';
import extend from 'deep-extend';
import CSSselect from 'css-select';
import { parseDOM } from 'htmlparser2';
import { Parser as CssParser, Rule } from 'cssparser/lib/cssparser';
import { calculate as calculateSpecificity } from 'specificity';

import { initHover } from './hover';
import { getPseudoStyles, parseBools, toHTML, Styles } from './util';

const debug = createDebug('blessed-css');

function createStyle(css: string) {
	const parser = new CssParser();
	const ast = parser.parse(css);
	const json = ast.toJSON('simple');

	const rules: Rule[] = [];
	const specificities = new Map<string, number>();
	for (const rule of json.value) {
		if (rule.type !== 'rule') {
			continue;
		}

		rules.push(rule);

		for (const selector of rule.selectors) {
			// https://www.w3.org/TR/css3-selectors/#specificity
			specificities.set(
				selector,
				parseInt(
					calculateSpecificity(selector)[0]
						.specificityArray.slice(1) // skip [0] because we don't consider inline styles
						.join(''),
					10
				)
			);
		}
	}

	const baseStylesMap = new WeakMap<
		blessed.Widgets.BlessedElement,
		Map<string, Styles>
	>();
	const activeEffectsMap = new WeakMap<
		blessed.Widgets.BlessedElement,
		Set<string>
	>();
	const computedEffectsMap = new WeakMap<
		blessed.Widgets.BlessedElement,
		Map<string, Styles>
	>();

	function get(
		container: blessed.Widgets.BlessedElement,
		selector = '',
		parentStyle: Styles | null = null,
		inlineStyle: Styles = {}
	): Styles {
		const { screen } = container;
		initHover(screen);

		// register `container` as "clickable" to make "hover" events work
		// XXX: undocumented API :(
		// @ts-ignore
		screen._listenMouse(container);

		const html = toHTML(container, selector, true);
		debug('Generated HTML %o', html);
		const dom = parseDOM(html);

		const self = CSSselect.selectOne('[self]', dom);

		const matches = [];
		for (const rule of rules) {
			for (const selector of rule.selectors) {
				const formattedSelector = selector.replace(/:/g, '.__pseudo_');
				const match = CSSselect.selectAll(formattedSelector, dom).some(
					match => match === self
				);
				if (match) {
					matches.push({ selector, rule });
				}
			}
		}

		const sorted = matches
			.sort((a, b) => {
				return (
					specificities.get(a.selector)! -
					specificities.get(b.selector)!
				);
			})
			.map(m => m.rule.declarations);

		const computed: Styles = extend({}, ...sorted);
		parseBools(computed);

		// When a selector is being calculated, compute the base styles
		// and remove the ones that have not been explicitly overwritten
		if (selector) {
			const baseComputed = baseStylesMap.get(container)!.get('');
			if (baseComputed) {
				for (const prop of Object.keys(computed)) {
					if (computed[prop] === baseComputed[prop]) {
						delete computed[prop];
					}
				}
			}
		}

		// Prototype chain is set up like:
		//   parentStyle -> computedStyle -> inlineStyle
		const computedStyle = parentStyle
			? extend(Object.create(parentStyle), computed)
			: computed;
		Object.setPrototypeOf(inlineStyle, computedStyle);
		return inlineStyle;
	}

	function addStyle(container: blessed.Widgets.BlessedElement): Styles {
		// @ts-ignore
		const parentStyle = container.parent && container.parent.style;
		const inlineStyle = container.options.style;
		container.style = get(container, '', parentStyle, inlineStyle);

		const baseStyles = new Map<string, Styles>();
		baseStylesMap.set(container, baseStyles);

		baseStyles.set('', Object.getPrototypeOf(container.style));

		for (const prop of getPseudoStyles(container)) {
			const base = inlineStyle && inlineStyle[prop];
			if (base) {
				// Blessed does a weird thing where is adds a default `border` object with
				// `bg` and `fg` set to `undefined`, which gets in the way of prototypal
				// inheritance, so remove any undefined values first
				for (const prop of Object.keys(base)) {
					if (typeof base[prop] === 'undefined') {
						delete base[prop];
					}
				}
			}
			container.style[prop] = get(
				container,
				`:${prop}`,
				container.style,
				base
			);
			baseStyles.set(prop, Object.getPrototypeOf(container.style[prop]));
		}

		// So in `blessed/lib/widgets/element.js` there's this bit of code:
		//
		//;[['hover', 'mouseover', 'mouseout', '_htemp'],
		// ['focus', 'focus', 'blur', '_ftemp']].forEach(props => {
		//  const pname = props[0], over = props[1], out = props[2], temp = props[3];
		//  container.screen.setEffects(container, container, over, out, container.style[pname], temp);
		//});
		//
		// Basically it sets up the "hover" and "focus" events. The problem is that
		// the way it's currently implemented there is no way to change the styling
		// if it was not initially passed in as an option to the element's
		// constructor (the `container.style[pname]` part). This is problematic for
		// the `blessed-css` API, where you compute the styles after creating the
		// element. Therefore, the behavior is re-implemented here in a way that
		// integrates with the CSS engine more cleanly.
		//
		// XXX: There might be a need to ensure this function is only run once
		// per effect name per container
		activeEffectsMap.set(container, new Set());
		computedEffectsMap.set(container, new Map());
		bindEffects(container, 'focus', 'focus', 'blur');
		bindEffects(container, 'hover', 'mouseenter', 'mouseleave');

		return container.style;
	}

	function bindEffects(
		container: blessed.Widgets.BlessedElement,
		name: string,
		over: string,
		out: string
	) {
		const activeEffects = activeEffectsMap.get(container);
		if (!activeEffects) {
			return;
		}

		container.on(over, () => {
			activeEffects.add(name);
			renderEffects(container, activeEffects);
		});

		container.on(out, () => {
			activeEffects.delete(name);
			renderEffects(container, activeEffects);
		});
	}

	function setEffect(
		container: blessed.Widgets.BlessedElement,
		effectSelector: string,
		prop = ''
	) {
		const computedEffects = computedEffectsMap.get(container);
		if (!computedEffects) {
			return;
		}
		const style = prop ? container.style[prop] : container.style;
		const baseStyles = baseStylesMap.get(container)!;
		let baseStyle = baseStyles.get(prop);
		if (!baseStyle) {
			baseStyle = Object.getPrototypeOf(style);
			baseStyles.set(prop, baseStyle!);
		}

		const selector = prop ? `${effectSelector}:${prop}` : effectSelector;
		let effectStyle = effectSelector
			? computedEffects.get(selector)
			: baseStyle;
		if (!effectStyle) {
			debug('Caching effect styles for %o %o', container.type, selector);
			effectStyle = get(container, selector, baseStyle);
			computedEffects.set(selector, effectStyle);
		}
		Object.setPrototypeOf(style, effectStyle);
	}

	function renderEffects(
		container: blessed.Widgets.BlessedElement,
		effects: Iterable<string>
	) {
		const selector = Array.from(effects)
			.sort()
			.map(e => `:${e}`)
			.join('');

		setEffect(container, selector);
		for (const prop of Object.keys(container.style)) {
			setEffect(container, selector, prop);
		}

		container.screen.render();
	}

	addStyle.get = get;

	return addStyle;
}

export = createStyle;
