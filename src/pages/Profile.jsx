import { EmptyState } from '../design/EmptyState.jsx'

export default function Profile() {
  return (
    <div className="page">
      <h1>Profile</h1>
      <EmptyState icon="user" title="Profile is coming">
        Accounts, cloud backup and your public artist page arrive in Stage 7. Until then, Gala works fully on this
        device.
      </EmptyState>
    </div>
  )
}
