import assert from 'assert';
import blessed from 'blessed';
import {
	parseBools,
	parseClassName,
	getPseudoStyles,
	toHTML
} from '../src/util';

test('parseBools()', async () => {
	const a = { bg: 'blue', fg: 'green' };
	parseBools(a);
	assert.deepEqual(a, { bg: 'blue', fg: 'green' });

	const b = { bold: 'true', inverse: 'false' };
	parseBools(b);
	assert.deepEqual(b, { bold: true, inverse: false });

	const c = { bold: 'false', inverse: 'false', border: { bold: 'true' } };
	parseBools(c);
	assert.deepEqual(c, {
		bold: false,
		inverse: false,
		border: { bold: true }
	});
});

test('parseClassName()', async () => {
	let parsed;

	parsed = parseClassName();
	assert.deepEqual(parsed, []);

	parsed = parseClassName('');
	assert.deepEqual(parsed, []);

	parsed = parseClassName([]);
	assert.deepEqual(parsed, []);

	parsed = parseClassName('foo bar');
	assert.deepEqual(parsed, ['foo', 'bar']);

	parsed = parseClassName('  foo    bar  ');
	assert.deepEqual(parsed, ['foo', 'bar']);

	parsed = parseClassName(['foo', 'bar']);
	assert.deepEqual(parsed, ['foo', 'bar']);

	parsed = parseClassName(new Set(['foo', 'bar']));
	assert.deepEqual(parsed, ['foo', 'bar']);
});

test('getPseudoStyles()', async () => {
	let pseudoStyles: Set<string>;
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen
		});
		pseudoStyles = getPseudoStyles(box);
		assert.deepEqual(Array.from(pseudoStyles).sort(), ['border', 'label']);

		const progressBar = blessed.progressbar({
			parent: screen,
			orientation: 'vertical',
			pch: ' ',
			filled: 0,
			value: 0,
			keys: true,
			mouse: true
		});
		pseudoStyles = getPseudoStyles(progressBar);
		assert.deepEqual(Array.from(pseudoStyles).sort(), ['bar', 'border', 'label']);

		const list = blessed.list({
			parent: screen
		});
		pseudoStyles = getPseudoStyles(list);
		assert.deepEqual(Array.from(pseudoStyles).sort(), [
			'border',
			'item',
			'label',
			'selected'
		]);

		const table = blessed.table({
			parent: screen
		});
		pseudoStyles = getPseudoStyles(table);
		assert.deepEqual(Array.from(pseudoStyles).sort(), [
			'border',
			'cell',
			'header',
			'label'
		]);
	} finally {
		screen.destroy();
	}
});

test('toHTML()', async () => {
	let html: string;
	let node: blessed.Widgets.Node;
	const screen = blessed.screen();
	try {
		// Screen
		html = toHTML(screen);
		assert.equal(html, '<screen></screen>');

		// Basic `Box`
		node = blessed.box({
			parent: screen
		});

		html = toHTML(node);
		assert.equal(html, '<screen><box></box></screen>');

		html = toHTML(node, '', true);
		assert.equal(html, '<screen><box self></box></screen>');

		html = toHTML(node, ':border');
		assert.equal(
			html,
			'<screen><box class="__pseudo_border"></box></screen>'
		);

		// `Box` with attributes
		node = blessed.box({
			parent: screen,
			id: 'theid',
			className: 'foo bar',
			name: 'thename',
			shadow: true
		});

		html = toHTML(node);
		assert.equal(
			html,
			'<screen><box class="foo bar" name="thename" id="theid" shadow></box></screen>'
		);

		// `Box` with `draggable: false`
		node = blessed.box({
			parent: screen,
			draggable: false
		});

		html = toHTML(node);
		assert.equal(html, '<screen><box></box></screen>');
	} finally {
		screen.destroy();
	}
});
