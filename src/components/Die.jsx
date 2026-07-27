// Ein Würfel als Pip-Raster. Bewusst ohne eigene Animation, damit ihn die
// Kniffel-Feier, das Eingabe-Modal und die Statistik gleich verwenden können.

// Pip-Positionen im 3x3-Raster je Augenzahl.
export const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export const FACE_NAME = [
  '',
  'Einser',
  'Zweier',
  'Dreier',
  'Vierer',
  'Fünfer',
  'Sechser',
]

// size: beliebiger CSS-Längenwert, damit Aufrufer auch min(15vw, 58px) o.ä.
// übergeben können. glow blendet den goldenen Schein für die Feier ein.
export default function Die({ size = 32, face, glow = false, style }) {
  const pips = PIPS[face] ?? PIPS[1]
  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(150deg, #ffffff, #d9d4e8)',
        borderRadius: `calc(${typeof size === 'number' ? `${size}px` : size} * 0.2)`,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: `calc(${typeof size === 'number' ? `${size}px` : size} * 0.12)`,
        boxSizing: 'border-box',
        boxShadow: glow
          ? '0 6px 18px rgba(0,0,0,0.55), 0 0 26px rgba(255,196,0,0.55), inset 0 -3px 6px rgba(0,0,0,0.18)'
          : 'inset 0 -2px 4px rgba(0,0,0,0.18)',
        ...style,
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pips.includes(i) && (
            <div
              style={{
                width: '72%',
                height: '72%',
                borderRadius: '50%',
                background: '#1a1526',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
