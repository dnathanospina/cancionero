# Cancionero Bethel

Cancionero digital (PWA) para el equipo de música: acordes en formato ChordPro,
partituras de batería (texto, PDF o imágenes) y listas por evento compartidas.
Se instala como una app en iPhone, iPad y Android y funciona sin conexión.

**App:** https://dnathanospina.github.io/cancionero/

## Qué hace

- **Dos cancioneros:** *Voces e instrumentos* y *Batería*. Se cambia con el selector de arriba.
- **Listas por evento** («Culto dominical», «Pascua»…) con fecha. La del próximo evento aparece destacada al abrir la app. Cada lista muestra la versión de voces o la de batería de las mismas canciones.
- **ChordPro:** acordes encima de la letra, coros destacados, comentarios, tablaturas o ritmos de batería, tempo y compás.
- **Archivos `.txt`** con acordes encima de la letra: se convierten automáticamente.
- **Transponer** ± semitonos y **capo** (muestra las formas que se tocan y el tono que suena), en notación **americana (C D E)** o **latina (Do Re Mi)**. Se recuerda por canción y por lista.
- **Solo letra** para cantantes, **tamaño de letra**, **modo oscuro**.
- **PDF e imágenes** con zoom (botones o dos dedos).
- **Desplazamiento automático** con velocidad ajustable. Un toque en la partitura muestra u oculta los controles.
- **Pedal Bluetooth:** AvPág/↓ baja la pantalla (al final pasa a la siguiente canción de la lista), RePág/↑ sube, →/← cambian de canción, Espacio inicia o pausa el desplazamiento. Las teclas se pueden cambiar en Ajustes.
- **La pantalla no se apaga** mientras hay una canción abierta.
- **Copia de seguridad** de los ajustes personales y de los archivos importados.

## Estructura de la carpeta compartida

```
Cancionero/
├── Voces/                    canciones de voces e instrumentos
│   ├── Castillo fuerte.cho
│   └── ...
├── Bateria/                  mismo nombre = versión de batería de esa canción
│   ├── Castillo fuerte.pdf
│   ├── Himno nuevo/          una subcarpeta con imágenes = una canción de varias páginas
│   │   ├── 1.jpg
│   │   └── 2.jpg
│   └── ...
└── Listas/
    ├── 2026-11-15 Domingo.txt
    └── 2027-03-28 Pascua.txt
```

Formatos admitidos: `.cho`, `.pro`, `.chordpro`, `.chopro`, `.crd`, `.txt`, `.pdf`, `.jpg`, `.png`, `.webp`, `.gif`.
Dentro de `Voces/` puedes crear subcarpetas para organizar (por ejemplo `Himnos/`); la app las tiene en cuenta.

### Emparejar voces y batería

1. **Mismo nombre de archivo** en `Voces/` y `Bateria/`. La extensión puede ser distinta, y no importan tildes, mayúsculas ni espacios de más.
2. Si los nombres no coinciden, añade al archivo de voces:
   `{x_bateria: Nombre del archivo de batería}`

En *Ajustes → Revisión de nombres* se ven las canciones sin pareja y las de las listas que no se encuentran.

### Formato de las listas

Un archivo de texto en `Listas/`. Se puede editar desde la app de OneDrive en el móvil:

```
nombre: Culto dominical
fecha: 2026-11-15
hora: 11:00
notas: Santa cena al final

Castillo fuerte | tono: D
Santo santo santo | tono: Eb | notas: estrofa 2 solo piano
Amazing Grace
```

- **Cabecera:** `nombre`, `fecha` (`AAAA-MM-DD` o `DD/MM/AAAA`), y de forma opcional `hora`, `lugar` y `notas`. Si falta el nombre o la fecha, se toman del nombre del archivo (`2026-11-15 Domingo.txt`).
- **Canciones:** una por línea, con el nombre del archivo o el título. Si pones `tono`, la app transpone para todos. Las líneas que empiezan por `#` son comentarios.

## Demostración

Mientras no haya conexión con OneDrive (fase 2), la app usa una biblioteca de demostración
(`public/demo/Cancionero`) con la misma estructura. Incluye solo himnos de dominio público:
Lutero/Cabrera, Heber/Cabrera, Newton, Crosby y Ken. Los acordes y las partituras de batería son
arreglos propios. En las listas de demostración, `@domingo` se sustituye por la fecha del próximo
domingo para que siempre haya un evento próximo.

## Logo

Copia el logo a `public/brand/` y pon su ruta en `src/config.js` (`logo`).
Mientras tanto se muestra el nombre «Bethel» en texto.

## Desarrollo

Requiere Node 22.

```bash
npm install
```

```bash
npm run dev      # http://localhost:5173/cancionero/
```

```bash
npm test         # pruebas del lector ChordPro, transposición, listas y biblioteca
```

```bash
npm run build    # genera dist/
```

Scripts opcionales (usan Playwright con Chromium): `node scripts/generate-icons.mjs` y
`node scripts/generate-demo-charts.mjs` regeneran los iconos y las partituras de demostración.

### Organización del código

| Carpeta | Contenido |
|---|---|
| `src/chordpro/` | Lector de ChordPro y conversión de `.txt` |
| `src/music/` | Acordes, notación americana/latina y transposición |
| `src/lists/` | Formato de las listas por evento |
| `src/library/` | Biblioteca: secciones, emparejamiento voces↔batería, búsqueda |
| `src/sources/` | Orígenes de datos (demostración; OneDrive en la fase 2) |
| `src/sync/` | Sincronización incremental y descarga de PDF/imágenes bajo demanda |
| `src/db.js` | Almacenamiento local (IndexedDB) |
| `src/viewers/` | Visores de ChordPro, PDF (pdf.js, carga diferida) e imágenes |
| `src/features/` | Desplazamiento automático, pedal, pantalla encendida, copias, instalación |
| `src/views/` | Pantallas: Inicio, Canciones, Listas, Canción, Ajustes |

### Caché y sin conexión

- **La app** (código, fuentes, pdf.js) queda guardada por el service worker. Las actualizaciones se avisan con «Hay una versión nueva».
- **Textos** (ChordPro, `.txt`, listas): se descargan al actualizar, y solo los que cambiaron (por eTag).
- **PDF e imágenes:** se descargan los de las próximas listas, en las dos secciones, y los demás al abrirlos. En Ajustes se puede activar «descargar todo».

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: pruebas, compilación y publicación en
GitHub Pages. Antes hay que activarlo una sola vez en *Settings → Pages → Source: GitHub Actions*.
