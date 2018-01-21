const debug = require('debug')('blessed-css')
const extend = require('deep-extend')
const CSSselect = require('css-select')
const { parseDOM } = require('htmlparser2')
const cssparser = require('cssparser/lib/cssparser')
const { calculate: calculateSpecificity } = require('specificity')

module.exports = createStyle

// property names to map to HTML attributes when serializing as HTML
const attrProps = new Set(['name', 'id', 'draggable', 'scrollable', 'shadow'])

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

  function get(container, selector = '', parentStyle = null, inlineStyle = {}) {
    const html = toHTML(container, selector, true)
    debug('Generated HTML %o', html)
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

    const computed = parseBools(extend({}, ...sorted))

    // When a selector is being calculated, compute the base styles
    // and remove the ones that have not been explicitly overwritten
    if (selector) {
      const baseComputed = baseStylesMap.get(container).get('')
      for (const prop of Object.keys(computed)) {
        if (computed[prop] === baseComputed[prop]) {
          delete computed[prop]
        }
      }
    }

    // Prototype chain is set up like:
    //   parentStyle -> computedStyle -> inlineStyle
    const computedStyle = parentStyle
      ? extend(Object.create(parentStyle), computed)
      : computed
    Object.setPrototypeOf(inlineStyle, computedStyle)
    return inlineStyle
  }

  function addStyle(container) {
    const parentStyle = container.parent && container.parent.style
    const inlineStyle = container.options.style
    container.style = get(container, '', parentStyle, inlineStyle)

    const baseStyles = new Map()
    baseStylesMap.set(container, baseStyles)

    baseStyles.set('', Object.getPrototypeOf(container.style))

    for (const prop of ['border', 'scrollbar']) {
      const base = inlineStyle && inlineStyle[prop]
      if (base) {
        // Blessed does a weird thing where is adds a default `border` object with
        // `bg` and `fg` set to `undefined`, which gets in the way of prototyal
        // inheritance, so remove any undefined values first
        for (const prop of Object.keys(base)) {
          if (typeof base[prop] === 'undefined') {
            delete base[prop]
          }
        }
      }
      container.style[prop] = get(container, `:${prop}`, container.style, base)
      baseStyles.set(prop, Object.getPrototypeOf(container.style[prop]))
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
    activeEffectsMap.set(container, new Set())
    computedEffectsMap.set(container, new Map())
    setEffects(container, 'focus', 'focus', 'blur')
    setEffects(container, 'hover', 'mouseover', 'mouseout')

    return container.style
  }

  const baseStylesMap = new WeakMap()
  const activeEffectsMap = new WeakMap()
  const computedEffectsMap = new WeakMap()

  function setEffects(container, name, over, out) {
    let activeEffects = activeEffectsMap.get(container)

    container.on(over, () => {
      activeEffects.add(name)
      renderEffects(container, activeEffects)
    })

    container.on(out, () => {
      activeEffects.delete(name)
      renderEffects(container, activeEffects)
    })
  }

  function setEffect(container, effectSelector, prop = '') {
    const computedEffects = computedEffectsMap.get(container)
    const style = prop ? container.style[prop] : container.style
    const baseStyle = baseStylesMap.get(container).get(prop)

    const selector = prop ? `${effectSelector}:${prop}` : effectSelector
    let effectStyle = effectSelector ? computedEffects.get(selector) : baseStyle
    if (!effectStyle) {
      debug('Caching effect styles for %o %o', container.type, selector)
      effectStyle = get(container, selector, baseStyle)
      computedEffects.set(selector, effectStyle)
    }
    Object.setPrototypeOf(style, effectStyle)
  }

  function renderEffects(container, effects) {
    const selector = Array.from(effects)
      .sort()
      .map(e => `:${e}`)
      .join('')

    setEffect(container, selector)
    for (const prop of Object.keys(container.style)) {
      setEffect(container, selector, prop)
    }

    container.screen.render()
  }

  addStyle.get = get

  return addStyle
}
