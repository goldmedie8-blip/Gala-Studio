import { ICONS, hasIcon } from './icons.js'

export function Icon({ name, size = 20, strokeWidth = 1.75, ...rest }) {
  if (!hasIcon(name)) {
    throw new Error(`Unknown icon "${name}". Add it to src/design/icons.js first.`)
  }
  const Component = ICONS[name]
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />
}
