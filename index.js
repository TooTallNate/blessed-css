const extend = require('deep-extend')
const CSSselect = require('css-select')
const { parseDOM } = require('htmlparser2')
const cssparser = require('cssparser/lib/cssparser')
const { calculate: calculateSpecificity } = require('specificity')

module.exports = createStyle

function deleteEmpty(o) {
  for (const k of Object.keys(o)) {
    if (o[k] == null) {
      delete o[k]
    } else if (typeof o[k] === 'object') {
      deleteEmpty(o[k])
    }
  }
  return o
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

function toHTML(container, pseudo, self = false, children = '') {
  const name = container.constructor.name.toLowerCase()
  let className = ''
  if (container.options.classNames) {
    className = encodeURIComponent(
      Array.from(container.options.classNames).join(' ')
    )
  }
  if (pseudo) {
    className += ` __pseudo_${pseudo}`
  }
  const html = `<${name} class="${className}" ${self ? 'self' : ''}>${children}</${
    name
  }>`
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

  function getStyle(container, pseudo = null) {
    const html = toHTML(container, pseudo, true)
    //console.log(html)

    const [dom] = parseDOM(html)

    const [self] = CSSselect.selectAll('[self]', [dom])
    //console.log(self)

    const matches = new Map()
    for (const rule of rules) {
      for (const _selector of rule.selectors) {
        try {
          const selector = _selector.replace(':', '.__pseudo_')
          //console.error(selector)
          const match = CSSselect.selectAll(selector, [dom]).some(
            match => match === self
          )
          if (match) {
            matches.set(_selector, rule)
            //console.log(rule)
          }
        } catch (err) {
          console.error(_selector, err)
        }
      }
    }
    //console.log(matches)

    const sorted = Array.from(matches.keys())
      .sort((a, b) => {
        return specificities.get(a) - specificities.get(b)
      })
      .map(key => matches.get(key).declarations)
    //console.log(sorted)

    const current = deleteEmpty(
      extend({}, pseudo ? container.style[pseudo] : container.style)
    )

    //console.log({ pseudo, current })
    return parseBools(extend({}, ...sorted, current))
  }

  function addStyle(container) {
    container.style = getStyle(container)
    container.style.border = getStyle(container, 'border')
    container.style.focus = getStyle(container, 'focus')
    container.style.hover = getStyle(container, 'hover')
    container.style.scrollbar = getStyle(container, 'scrollbar')
    return container.style
  }

  addStyle.getStyle = getStyle

  return addStyle
}
