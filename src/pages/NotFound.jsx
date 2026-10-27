import { Link } from 'react-router-dom'
import { EmptyState } from '../design/EmptyState.jsx'

export default function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <EmptyState icon="search" title="We could not find that page">
        The link may be old or mistyped.
      </EmptyState>
      <div className="row">
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
      </div>
    </div>
  )
}
