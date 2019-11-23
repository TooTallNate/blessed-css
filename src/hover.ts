import blessed from 'blessed';

// TODO: PR this change upstream
interface ScreenWithClickable extends blessed.Widgets.Screen {
	clickable: blessed.Widgets.BlessedElement[];
}

// http://2ality.com/2015/01/es6-set-operations.html#difference
function difference<T>(a: Set<T>, b: Set<T>): T[] {
	return [...a].filter(x => !b.has(x));
}

const hoveredMap = new WeakMap<
	blessed.Widgets.Screen,
	Set<blessed.Widgets.BlessedElement>
>();

export function initHover(screen: blessed.Widgets.Screen) {
	if (hoveredMap.has(screen)) return;
	hoveredMap.set(screen, new Set());
	screen.on('mousemove', onMouseMove);
}

export function onMouseMove(
	this: ScreenWithClickable,
	data: blessed.Widgets.Events.IMouseEventArg
) {
	const screen = this;
	const hovered = hoveredMap.get(screen);
	if (!hovered) {
		return;
	}
	const newHovered = new Set<blessed.Widgets.BlessedElement>();

	for (const el of screen.clickable) {
		if (el.detached || !el.visible) {
			continue;
		}
		const pos = el.lpos;
		if (
			data.x >= pos.xi &&
			data.x < pos.xl &&
			data.y >= pos.yi &&
			data.y < pos.yl
		) {
			newHovered.add(el);
		}
	}

	// ones that are in `newHovered`, but not yet in `hovered`
	const mouseenter = difference(newHovered, hovered);

	// ones that are in `hovered`, but no longer in `newHovered`
	const mouseleave = difference(hovered, newHovered);

	for (const el of mouseenter) {
		el.emit('mouseenter', data);
		hovered.add(el);
	}

	for (const el of mouseleave) {
		el.emit('mouseleave', data);
		hovered.delete(el);
	}
}
