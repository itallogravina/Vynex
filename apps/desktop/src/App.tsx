import { VYNEX_VERSION } from '@vynex/shared'

export default function App() {
  return (
    <main>
      <h1>Vynex</h1>
      <footer style={{ marginTop: '2rem', color: '#999', fontSize: '0.875rem' }}>
        v{VYNEX_VERSION}
      </footer>
    </main>
  )
}
