import { EmptyState } from '../design/EmptyState.jsx'

export default function Library() {
  return (
    <div className="page">
      <h1>Library</h1>
      <EmptyState icon="library" title="No projects yet">
        Your songs, beats and recordings will live here and stay on your device. Saving projects arrives in Stage 1.
      </EmptyState>
    </div>
  )
}
