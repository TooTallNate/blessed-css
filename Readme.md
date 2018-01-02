# blessed-css

CSS engine for [`blessed`][blessed].

<img width="693" src="https://user-images.githubusercontent.com/71256/34500365-483b1506-efbf-11e7-8c7c-fa9b130e707b.png">

```js
const blessed = require('blessed')
const css = require('blessed-css')

const style = css(`
  #background {
    bg: blue;
  }

  .dialog {
    fg: black;
    bg: white;
  }

  .dialog:border {
    fg: magenta;
  }
`)

const screen = blessed.screen({
  smartCSR: true
})

const background = blessed.box({
  parent: screen,
  id: 'background'
})

// Style the `box#background` according to the CSS rules
style(background)

const box = blessed.box({
  parent: screen,
  className: 'dialog',
  top: 'center',
  left: 'center',
  width: '60%',
  height: '55%',
  content: 'Hello world!',
  border: 'line',
  shadow: true
})

// Style the `box.dialog` according to the CSS rules
style(box)

screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0))

screen.render()
```

[blessed]: https://github.com/chjj/blessed
