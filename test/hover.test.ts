import assert from 'assert';
import blessed from 'blessed';
import { initHover, onMouseMove } from '../src/hover';

test('missing `screen`', async () => {
	const screen = blessed.screen();
	try {
		screen.on('mousemove', onMouseMove);
		screen.emit('mousemove', { x: 0, y: 0 });
	} finally {
		screen.destroy();
	}
});

test('"mouseenter"/"mouseleave" events', async () => {
	let mouseenterCount = 0;
	let mouseleaveCount = 0;
	const screen = blessed.screen();
	initHover(screen);
	try {
		const box = blessed.box({
			parent: screen,
			clickable: true
		});
		box.on('mouseenter', () => mouseenterCount++);
		box.on('mouseleave', () => mouseleaveCount++);
		screen.render();

		assert(!box.detached);
		assert.equal(box.visible, true);
		screen.emit('mousemove', { x: 0, y: 0 });
		screen.emit('mousemove', { x: 10000, y: 10000 });
		assert.equal(mouseenterCount, 1);
		assert.equal(mouseleaveCount, 1);

		// Detached nodes should not receive these events
		box.detach();
		assert.equal(box.detached, true);
		screen.emit('mousemove', { x: 0, y: 0 });
		screen.emit('mousemove', { x: 10000, y: 10000 });
		assert.equal(mouseenterCount, 1);
		assert.equal(mouseleaveCount, 1);
	} finally {
		screen.destroy();
	}
});

test('skip hidden box', async () => {
	let mouseenterCount = 0;
	let mouseleaveCount = 0;
	const screen = blessed.screen();
	initHover(screen);
	try {
		const box = blessed.box({
			parent: screen,
			clickable: true,
			hidden: true
		});
		box.on('mouseenter', () => mouseenterCount++);
		box.on('mouseleave', () => mouseleaveCount++);
		screen.render();

		assert.equal(box.visible, false);
		screen.emit('mousemove', { x: 0, y: 0 });
		screen.emit('mousemove', { x: 10000, y: 10000 });
		assert.equal(mouseenterCount, 0);
		assert.equal(mouseleaveCount, 0);
	} finally {
		screen.destroy();
	}
});
