// Genera public/demo/Cancionero/ajustes-lider.json con el PIN de demostración (123456).
import { writeFileSync } from 'node:fs';
import { makePinRecord, leaderConfigText } from '../src/leader/pin.js';

const rec = await makePinRecord('123456');
writeFileSync(
  'public/demo/Cancionero/ajustes-lider.json',
  leaderConfigText(rec, { nota: 'Demostración: el PIN de líder es 123456. En la versión real, el líder crea el suyo desde la app.' }),
);
console.log('ajustes-lider.json de demostración generado');
