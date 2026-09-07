// Kanal für kurze Meldungen. Gleiche Idee wie celebrate.js und onSaveEvent in
// storage.js: beliebig viele Sender, ein einziger global gemounteter Empfänger
// (Toaster in main.jsx).

const listeners = new Set()

// Meldet sich für "es soll ein Toast erscheinen" an. Gibt eine Abmelde-Funktion
// zurück.
export function onToast(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// detail: { text, actionLabel?, onAction?, ms? }
//
// Mit actionLabel bekommt der Toast einen Button daneben — dafür steht er
// länger, sonst ist er weg, bevor man ihn treffen kann.
export function showToast(detail) {
  for (const cb of listeners) cb(detail)
}
