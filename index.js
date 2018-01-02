const extend = require('deep-extend')
const CSSselect = require('css-select')
const { parseDOM } = require('htmlparser2')
const cssparser = require('cssparser/lib/cssparser')
const { calculate: calculateSpecificity } = require('specificity')

module.exports = createStyle

// property names to map to HTML attributes when serializing as HTML
const attrProps = new Set([
  'name',
  'id',
  'draggable',
  'scrollable',
  'shadow'
])

function parseClassName(className) {
  if (!className) {
    return []
  } else if (typeof className === 'string') {
    return className.split(' ')
  } else {
    return Array.from(className)
  }
}

function parseBools(o) {
  for (const k of Object.keys(o)) {
    if (o[k] === 'true') {
      o[k] = true
    } else if (o[k] === 'false') {
      o[k] = false
    } else if (o[k] && typeof o[k] === 'object') {
      parseBools(o[k])
    }
  }
  return o
}

function toHTML(container, selector = '', self = false, children = '') {
  const name = container.constructor.name.toLowerCase()
  const classNames = new Set([
    ...parseClassName(container.options.className),
    ...parseClassName(container.options.classNames),
    ...selector
      .split(':')
      .filter(Boolean)
      .map(s => `__pseudo_${s}`)
  ])
  let attrs = ''
  if (classNames.size > 0) {
    attrs += ` class="${Array.from(classNames).join(' ')}"`
  }
  for (const prop of attrProps) {
    const val = container[prop] || container.options[prop]
    if (typeof val === 'boolean' && val) {
      attrs += ` ${prop}`
    } else if (val != null) {
      attrs += ` ${prop}="${val}"`
    }
  }
  if (self) {
    attrs += ' self'
  }
  const html = `<${name}${attrs}>${children}</${name}>`
  if (container.parent) {
    return toHTML(container.parent, '', false, html)
  } else {
    return html
  }
}

function createStyle(css) {
  // create new instance of Parser
  const parser = new cssparser.Parser()

  // parse
  const ast = parser.parse(css)

  // getting json
  const json = ast.toJSON('simple')

  const rules = []
  const specificities = new Map()
  for (const rule of json.value) {
    if (rule.type !== 'rule') {
      continue
    }

    rules.push(rule)

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
      )
    }
  }

  function get(container, selector = '') {
    const html = toHTML(container, selector, true)

    const dom = parseDOM(html)

    const self = CSSselect.selectOne('[self]', dom)

    const matches = []
    for (const rule of rules) {
      for (const selector of rule.selectors) {
        const formattedSelector = selector.replace(/:/g, '.__pseudo_')
        const match = CSSselect.selectAll(formattedSelector, dom).some(
          match => match === self
        )
        if (match) {
          matches.push({ selector, rule })
        }
      }
    }

    const sorted = matches
      .sort((a, b) => {
        return specificities.get(a.selector) - specificities.get(b.selector)
      })
      .map(m => m.rule.declarations)

    return parseBools(extend({}, ...sorted))
  }

  function addStyle(container) {
    container.style = get(container)
    container.style.border = get(container, ':border')
    container.style.focus = get(container, ':focus')
    container.style.hover = get(container, ':hover')
    container.style.scrollbar = get(container, ':scrollbar')
    return container.style
  }

  addStyle.get = get

  return addStyle
}
