import assert from 'assert';
import blessed from 'blessed';
import css from '../src';

test('Node type styles', async () => {
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen
		});
		css(`
		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		  }
		`)(box);
		assert.equal(box.style.bg, 'blue');
		assert.equal(box.style.fg, 'red');
		assert.equal(box.style.bold, true);
	} finally {
		screen.destroy();
	}
});

test('Inline styles', async () => {
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen,
			style: {
				fg: 'black',
				transparent: false,
				underline: true
			}
		});
		css(`
		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		    underline: false;
		  }
		`)(box);
		assert.equal(box.style.bg, 'blue');
		assert.equal(box.style.fg, 'black');
		assert.equal(box.style.bold, true);
		assert.equal(box.style.transparent, false);
		assert.equal(box.style.underline, true);
	} finally {
		screen.destroy();
	}
});

test('#id styles', async () => {
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen,
			id: 'theid'
		});
		css(`
		  #theid {
		    bg: green;
		  }

		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		  }
		`)(box);
		assert.equal(box.style.bg, 'green');
		assert.equal(box.style.fg, 'red');
		assert.equal(box.style.bold, true);
	} finally {
		screen.destroy();
	}
});

test('.className styles', async () => {
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen,
			className: 'foo bar'
		});
		css(`
		  .foo {
		    bg: green;
		  }

		  .bar {
		    fg: yellow;
		  }

		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		  }
		`)(box);
		assert.equal(box.style.bg, 'green');
		assert.equal(box.style.fg, 'yellow');
		assert.equal(box.style.bold, true);
	} finally {
		screen.destroy();
	}
});

test(':border styles', async () => {
	const screen = blessed.screen();
	try {
		const box = blessed.box({
			parent: screen
		});
		css(`
		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		  }

		  :border {
		    fg: black;
		    bold: false;
		  }
		`)(box);
		assert.equal(box.style.bg, 'blue');
		assert.equal(box.style.fg, 'red');
		assert.equal(box.style.bold, true);

		assert.equal(box.style.border.bg, 'blue');
		assert.equal(box.style.border.fg, 'black');
		assert.equal(box.style.border.bold, false);
	} finally {
		screen.destroy();
	}
});

test('[draggable] styles', async () => {
	const screen = blessed.screen();
	try {
		const style = css(`
		  box {
		    bg: blue;
		    fg: red;
		    bold: true;
		  }

		  [draggable] {
		    fg: black;
		    bold: false;
		  }
		`);
		const draggable = blessed.box({
			parent: screen,
			draggable: true
		});
		style(draggable);
		assert.equal(draggable.draggable, true);
		assert.equal(draggable.style.bg, 'blue');
		assert.equal(draggable.style.fg, 'black');
		assert.equal(draggable.style.bold, false);

		const notDraggable = blessed.box({
			parent: screen,
			draggable: false
		});
		style(notDraggable);
		assert.equal(notDraggable.draggable, false);
		assert.equal(notDraggable.style.bg, 'blue');
		assert.equal(notDraggable.style.fg, 'red');
		assert.equal(notDraggable.style.bold, true);
	} finally {
		screen.destroy();
	}
});
