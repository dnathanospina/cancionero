/**
 * Identidad visual. Para usar el logo de la iglesia:
 *  1. Copia el archivo a public/brand/ (por ejemplo public/brand/logo.svg)
 *  2. Pon aquí su ruta: logo: import.meta.env.BASE_URL + 'brand/logo.svg'
 * Mientras `logo` sea null se muestra el nombre en texto.
 */
export const BRAND = {
  name: 'Bethel',
  logo: null,
};

/**
 * Dónde escribe el modo líder (listas y PIN). Las rutas que usa la app son
 * «lógicas» (Listas/…, ajustes-lider.json); cada origen de datos las traduce a
 * su ubicación real, así que cambiar de destino es cambiar esta configuración.
 *
 *  location: 'appFolder' → OneDrive: Aplicaciones/Cancionero Bethel/
 *                          (permiso mínimo Files.ReadWrite.AppFolder)
 *            'library'   → dentro de la carpeta del cancionero
 *                          (necesita Files.ReadWrite)
 */
export const WRITE_TARGET = {
  location: 'appFolder',
  listsFolder: 'Listas',
  leaderFile: 'ajustes-lider.json',
};

/**
 * Estructura de carpetas de la biblioteca (rutas relativas a la carpeta raíz).
 * Se puede cambiar en Ajustes para adaptarse a la biblioteca de SongBook sin
 * reorganizar nada. Si `voces` está vacío, la carpeta raíz entera es «Voces» y
 * sus subcarpetas son categorías (como las organiza SongBook).
 */
export const DEFAULT_LAYOUT = {
  root: 'Cancionero',
  voces: 'Voces',
  bateria: 'Bateria',
  enlaces: 'Enlaces',
};
