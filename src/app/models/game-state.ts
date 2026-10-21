export interface GameStateJson {
  // Indeks 0 se ne koristi. Pozitivno = beli, negativno = crni.
  points: number[];
  whiteBar: number;
  blackBar: number;
  whiteOff: number;
  blackOff: number;
  dice: number[];
}
