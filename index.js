const extend = require('deep-extend')
const CSSselect = require('css-select')
const { parseDOM } = require('htmlparser2')
const cssparser = require('cssparser/lib/cssparser')
const { calculate: calculateSpecificity } = require('specificity')

module.exports = createStyle

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

function toHTML(container, selector = null, self = false, children = '') {
  const name = container.constructor.name.toLowerCase()
  const classNames = parseClassName(container.options.className).concat(
    parseClassName(container.options.classNames)
  )
  if (selector) {
    classNames.push(...selector.split(':').filter(Boolean).map(s => `__pseudo_${s}`))
  }
  const html = `<${name} class="${classNames.join(' ')}" ${self ? 'self' : ''}>${
    children
  }</${name}>`
  if (container.parent) {
    return toHTML(container.parent, null, false, html)
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
  //console.log(json.value)

  const rules = []
  const specificities = new Map()
  for (const rule of json.value) {
    //console.error(rule)
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
  //console.log(specificities)
  //console.log(Array.from(specificities.keys()))

  function get(container, selector = null) {
    const html = toHTML(container, selector, true)
    //console.log(html)

    const [dom] = parseDOM(html)

    const [self] = CSSselect.selectAll('[self]', [dom])
    //console.log(self)

    const matches = []
    for (const rule of rules) {
      for (const selector of rule.selectors) {
        try {
          const formattedSelector = selector.replace(/:/g, '.__pseudo_')
          //console.error(formattedSelector)
          const match = CSSselect.selectAll(formattedSelector, [dom]).some(
            match => match === self
          )
          if (match) {
            matches.push({ selector, rule })
            //matches.set(selector, rule)
            //console.log(rule)
          }
        } catch (err) {
          console.error(selector, err)
        }
      }
    }

    const sorted = matches
      .sort((a, b) => {
        return specificities.get(a.selector) - specificities.get(b.selector)
      })
      .map(m => m.rule.declarations)
    //console.log(sorted)

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
