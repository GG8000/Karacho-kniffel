// Wiederverwendbarer Ladespinner mit optionalem Info-Text.
// row=false: Ring über Text (Vollbild-/Sektions-Ladezustände)
// row=true:  Ring neben Text (inline in Buttons)
export default function Spinner({ label, size = 20, row = false }) {
  const ring = <span className="spinner" style={{ width: size, height: size }} />
  if (row)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {ring}
        {label && <span>{label}</span>}
      </span>
    )
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {ring}
      {label && (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {label}
        </div>
      )}
    </div>
  )
}
