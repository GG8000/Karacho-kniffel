// Übergabe der Erddrehung vom Ladebildschirm ans Menü.
//
// Beide zeigen eine Globe. Ohne Übergabe finge die Erde im Menü wieder bei
// derselben Länge an und würde beim Wechsel sichtbar springen. Der Ladebildschirm
// merkt sich seine letzte Länge, das Menü holt sie sich einmal ab und
// verwendet sie als startLon.

let lon = null

// Länge in Grad (Globe-ref.getRotation()) merken.
export function setGlobeHandoff(deg) {
  lon = Number.isFinite(deg) ? deg : null
}

// Holt den gemerkten Wert genau einmal ab, danach gibt es wieder null.
export function takeGlobeHandoff() {
  const v = lon
  lon = null
  return v
}
