// http://2ality.com/2015/01/es6-set-operations.html#difference
const difference = (a, b) => [...a].filter(x => !b.has(x))

module.exports = {
  initHover
}

const hoveredMap = new WeakMap()

function initHover(screen) {
  if (hoveredMap.has(screen)) return
  hoveredMap.set(screen, new Set())
  screen.on('mousemove', onMouseMove)
}

function onMouseMove(data) {
  const screen = this
  const hovered = hoveredMap.get(screen)
  const newHovered = new Set()

  for (const el of screen.clickable) {
    if (el.detached || !el.visible) {
      continue;
    }
    const pos = el.lpos
    if (data.x >= pos.xi && data.x < pos.xl
        && data.y >= pos.yi && data.y < pos.yl) {
      newHovered.add(el)
    }
  }

  // ones that are in `newHovered`, but not yet in `hovered`
  const mouseover = difference(newHovered, hovered)
  for (const el of mouseover) {
    el.emit('css mouseover', data)
    hovered.add(el)
  }

  // ones that are in `hovered`, but no longer in `newHovered`
  const mouseout = difference(hovered, newHovered)
  for (const el of mouseout) {
    el.emit('css mouseout', data)
    hovered.delete(el)
  }
}
