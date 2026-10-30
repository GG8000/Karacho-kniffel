// Flugbahn des Lade-Würfels (rein rechnerisch, damit sie ohne DOM testbar ist).
//
// EINE Kurve für p = 0..1: Der Würfel steigt senkrecht (keine Drehung, kein
// Pendeln) hinter der Erde auf, tritt am oberen Rand der Kugel aus und wächst
// dabei auf den Betrachter zu. Position, Größe und Schub sind reine Funktionen
// von p.

// Freiraum unter dem Würfel (in Vielfachen von s * B), den die Z-Umschaltung
// verlangt. Bewusst großzügig und unverändert aus der Zeit mit Flammensäule:
// So bleiben Bahn und Umschaltzeitpunkt exakt gleich, und Würfel samt Schein
// (Radius ca. 1,5 s*B) sind beim Umschalten sicher frei vom Rand der Erde.
const CLEAR_BASE = 0.54
const CLEAR_THRUST = 1.3

const lerp = (a, b, k) => a + (b - a) * k

// Schub: Das Triebwerk brennt schon beim Start und wird nur stärker (0.5 .. 1.9).
export const thrust = (p) => lerp(0.5, 1.9, p)

// l: Layout aus LaunchSplash (w, h, cx, cy, R, B, sx, sy), sMin/sMax: Start-/Endgröße.
export function makeFlight(l, sMin, sMax) {
  const lnA = Math.log(sMin)
  const lnB = Math.log(sMax)
  // Größe: exponentiell mit weichem Anlauf -> beschleunigt stark
  const scaleAt = (p) => Math.exp(lerp(lnA, lnB, Math.pow(p, 2.2)))
  // Höhenverlauf: halb linear, halb ease-out (keine Geschwindigkeit 0 am Start)
  const f = (p) => 0.6 * p + 0.4 * (1 - (1 - p) * (1 - p))
  const limb = l.cy - l.R // Oberkante der Scheibe in der Bildmitte

  // Z-Umschaltung ist erlaubt, sobald der ganze Würfel samt Schein über dem Rand
  // der Scheibe liegt (sonst sprängen Pixel sichtbar vor die Erde).
  const clearAt = (p, y) => {
    const bs = l.B * scaleAt(p)
    return y + bs * (CLEAR_BASE + CLEAR_THRUST * thrust(p) * 1.12) < limb - 0.15 * bs
  }

  // Zielhöhe beim Vorbeiflug. Auf breiten, flachen Fenstern liegt der Rand der
  // Kugel nahe an 42 % der Höhe; dann würde die Rakete nie frei und bliebe
  // hinter der Erde. Also das Ziel so weit nach oben schieben, dass sie spätestens
  // bei p = 0.4 frei ist.
  const pClear = (ty) => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100
      if (clearAt(p, lerp(l.sy, ty, f(p)))) return p
    }
    return 1
  }
  let ty = Math.min(l.h * 0.42, limb - l.h * 0.1)
  while (pClear(ty) > 0.4 && ty > l.h * 0.15) ty -= l.h * 0.02

  return {
    ty,
    scaleAt,
    path: (p) => [l.cx, lerp(l.sy, ty, f(p))],
    clearAt,
    pClear: pClear(ty),
  }
}
