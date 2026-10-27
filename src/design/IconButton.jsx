import { Icon } from './Icon.jsx'

export function IconButton({ icon, label, primary = false, size = 20, className = '', ...rest }) {
  const classes = ['icon-btn', primary ? 'icon-btn-primary' : '', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  )
}
