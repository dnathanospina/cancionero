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
- **PDF e imágenes página a página.** Deslizando a la izquierda pasas a la página siguiente; desde la última, a la siguiente canción de la lista (y al revés). Muestra la página (1/3) y avisa de cuál es la siguiente canción. El pellizco con dos dedos solo hace zoom. También hay vista *Continuo* con desplazamiento automático.
- **Deslizar entre canciones** de una lista también en las de texto: solo un gesto claramente horizontal, sin estorbar el desplazamiento ni la selección de texto.
- **Pantalla completa:** oculta las barras y un toque las muestra. En Android usa la pantalla completa del sistema; en iPhone, donde las PWA no pueden, se oculta la interfaz de la app.
- **Desplazamiento automático** con velocidad ajustable. Un toque en la partitura muestra u oculta los controles.
- **Pedal Bluetooth:** AvPág/↓ baja la pantalla (al final pasa a la siguiente canción de la lista), RePág/↑ sube, →/← cambian de canción, Espacio inicia o pausa el desplazamiento. En PDF/imágenes, el pedal pasa página y después canción. Las teclas se pueden cambiar en Ajustes.
- **Categorías** en Canciones, con su número de canciones (ver más abajo).
- **Escuchar:** cada canción puede tener su enlace (YouTube se abre en su app si está instalada), y cada lista tiene «Escuchar la lista» para preparar el ensayo.
- **La pantalla no se apaga** mientras hay una canción abierta.
- **Copia de seguridad** de los ajustes personales y de los archivos importados.
- **Modo líder con PIN** para crear, editar, duplicar y borrar las listas desde el móvil (ver más abajo).
- **Importar canciones a un solo dispositivo** (también exportaciones de SongBook y carpetas en .zip), para probar con canciones reales sin subirlas a ningún sitio.
- **Actualizaciones automáticas:** una versión nueva se instala sola, salvo si hay una canción abierta o una lista a medio editar; en ese caso espera hasta que se cierre.

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

También puede haber una carpeta `Enlaces/` (ver «Enlaces para escuchar»).

Formatos admitidos: `.cho`, `.pro`, `.chordpro`, `.chopro`, `.crd`, `.txt`, `.pdf`, `.jpg`, `.png`, `.webp`, `.gif`.
Dentro de `Voces/` y `Bateria/` puedes crear subcarpetas (por ejemplo `Himnos/`): cada subcarpeta es una categoría.

### Categorías

No están fijas en el código: se generan a partir de los archivos.

- **Etiquetas de SongBook:** `{tag: Himnos}`. Puede haber varias directivas `{tag}`, y una canción puede estar en varias categorías. También se entienden `{category}`, `{categories}`, `{keywords}`, `{x_tag}` y `{x_sbp_tags}`, con valores separados por comas o punto y coma.
- **Subcarpetas**, como organiza SongBook las suyas: `Voces/Navidad/Noche de paz.cho`.
- **«Todas» y «Sin categoría»** se añaden solas.
- **Batería:** la versión de batería hereda las categorías de su canción de voces, porque un PDF no puede llevar etiquetas.

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

### Enlaces para escuchar

Se puede indicar el enlace de tres maneras; la app entiende todas:

1. **En la canción:** `{x_youtube: https://www.youtube.com/watch?v=…}`. También `{youtube}`, `{link}` y `{url}`.
2. **Un archivo con muchas canciones** en `Enlaces/` (`.txt`, `.csv` o `.md`), una por línea:
   ```
   Castillo fuerte | https://www.youtube.com/watch?v=…
   Santo santo santo; https://youtu.be/…
   ```
   También vale el nombre en una línea y el enlace en la siguiente.
3. **Un archivo por canción** en `Enlaces/` con el mismo nombre: `.url` (acceso directo de Windows), `.webloc` (Mac) o `.txt` con el enlace dentro.

«Escuchar la lista» reproduce seguidas todas las canciones de YouTube (hasta 50) o permite abrirlas una a una.
La batería usa el enlace de su canción de voces.

## Modo líder y editor de listas

En *Listas → Editar listas* (o en Ajustes) se introduce el PIN de líder. El modo líder se mantiene en ese
dispositivo hasta que se cierra la app.

- **Nueva lista:** con la plantilla «Domingo» (próximo domingo a la hora configurada en Ajustes, por
  defecto las 11:00) o «Evento especial». Tiene nombre, fecha, hora y una nota.
- **Canciones:** se añaden desde el cancionero con el buscador y las categorías. Se reordenan arrastrando
  por el asa ⋮⋮. A cada una se le puede fijar el tono del evento y una nota. Se ve si tiene versión de
  batería y enlace para escuchar.
- **Duplicar, editar y borrar** (con confirmación) desde la página de cada lista.
- **Guardar** escribe `Listas/AAAA-MM-DD Nombre.txt` en el formato de texto de arriba.
- **Sin conexión:** lo guardado queda «pendiente de subir» y se sube solo al recuperar la conexión. Si
  otra persona cambió la misma lista mientras tanto, aparece un conflicto con tres opciones: quedarse con
  su versión, sobrescribir con la mía o guardar la mía como copia.
- **Si se cierra la app a mitad de una edición,** al volver se ofrece recuperar los cambios.

### PIN

- **Dónde se guarda:** en `ajustes-lider.json`, junto a las listas. El archivo no contiene el PIN, sino
  una huella PBKDF2-SHA256 con sal y 310 000 iteraciones. El PIN nunca está en el repositorio.
- **Cómo se crea y cambia:** la primera vez, el líder lo crea desde la app; después se cambia en Ajustes.
- **Límites:** tiene un mínimo de 6 dígitos y, tras 5 intentos fallidos, hay que esperar 30 segundos.
- **Qué no protege:** el PIN evita cambios por error o sin permiso desde la app, pero no protege los
  archivos. Con la contraseña de la cuenta compartida se pueden editar directamente en OneDrive, y quien
  tenga el archivo podría averiguar un PIN corto por fuerza bruta (lento, pero posible).

### Dónde se escribe

El destino está en `src/config.js` (`WRITE_TARGET`). Hay dos opciones:

- **`appFolder`** (por defecto): `Aplicaciones/Cancionero Bethel/` en OneDrive. Necesita el permiso
  mínimo `Files.ReadWrite.AppFolder`, y así la app no puede tocar las canciones.
- **`library`**: dentro de la carpeta del cancionero. Necesita `Files.ReadWrite`.

La app usa rutas «lógicas» (`Listas/…`, `ajustes-lider.json`) y cada origen de datos las traduce, así
que cambiar de destino no afecta al editor.

### Estructura de carpetas configurable

En *Ajustes → Carpetas en OneDrive* se indica la carpeta del cancionero y dónde están las canciones de
voces, las partituras de batería y los enlaces. Si las canciones de voces se dejan vacías, toda la
carpeta cuenta como voces y sus subcarpetas son categorías, como las organiza SongBook. Así no hace falta
reorganizar la biblioteca. Se aplicará al conectar OneDrive.

## Importar canciones reales a un dispositivo

En *Ajustes → Importar canciones a este dispositivo*. Se guardan solo en ese teléfono: no se suben ni
llegan al repositorio, y se pueden borrar desde ahí mismo.

- **Formatos:** `.cho`, `.chopro`, `.chordpro`, `.pro`, `.crd`, `.txt`, PDF, imágenes y **`.zip`**. Sirve,
  por ejemplo, una exportación de SongBook o una carpeta de OneDrive descargada como .zip.
- **Subcarpetas del .zip:** se convierten en categorías. Si el .zip trae carpetas «Voces» y «Batería»,
  se respetan.
- **Varias canciones en un archivo:** las separadas por `{new_song}` o `{ns}` se importan como canciones
  distintas.
- **Codificación:** se respetan las tildes y la ñ de archivos antiguos (Windows-1252).
- **Si la canción ya existe:** se elige entre reemplazarla u omitirla.

## Demostración

Mientras no haya conexión con OneDrive (fase 2), la app usa una biblioteca de demostración
(`public/demo/Cancionero`) con la misma estructura. Incluye solo himnos de dominio público:
Lutero/Cabrera, Heber/Cabrera, Newton, Crosby, Ken y Mohr/Fliedner.
El **PIN de líder de la demostración es `123456`**. Lo que se guarda va a una «OneDrive simulada» en el
dispositivo, con las mismas reglas que la real (pendientes sin conexión, conflictos). En Ajustes hay
botones para simular que otra persona cambia una lista y para restablecer la demostración. Tienen categorías de ejemplo, y
el botón «Escuchar» está desactivado porque no hay enlaces reales. Los acordes y las partituras de batería son
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
`node scripts/demo-pin.mjs` regenera el `ajustes-lider.json` de la demostración (PIN 123456).

### Organización del código

| Carpeta | Contenido |
|---|---|
| `src/chordpro/` | Lector de ChordPro y conversión de `.txt` |
| `src/music/` | Acordes, notación americana/latina y transposición |
| `src/lists/` | Formato de las listas por evento |
| `src/links/` | Enlaces para escuchar (YouTube, archivos .url/.webloc/.txt/.csv) |
| `src/leader/` | Modo líder: PIN (PBKDF2), sesión en el dispositivo y ventanas |
| `src/lists/` (outbox) | Cambios pendientes de subir, subida con control de versiones y conflictos |
| `src/library/` | Biblioteca: secciones, emparejamiento voces↔batería, búsqueda |
| `src/sources/` | Orígenes de datos (demostración; OneDrive en la fase 2) |
| `src/sync/` | Sincronización incremental y descarga de PDF/imágenes bajo demanda |
| `src/db.js` | Almacenamiento local (IndexedDB) |
| `src/viewers/` | Visores de ChordPro, PDF (pdf.js, carga diferida) e imágenes; página a página o continuo |
| `src/features/` | Desplazamiento automático, pedal, gestos, pantalla completa, escuchar, copias, instalación |
| `src/views/` | Pantallas: Inicio, Canciones, Listas, Canción, Ajustes |

### Caché y sin conexión

- **La app** (código, fuentes, pdf.js) queda guardada por el service worker. Las actualizaciones se avisan con «Hay una versión nueva».
- **Textos** (ChordPro, `.txt`, listas): se descargan al actualizar, y solo los que cambiaron (por eTag).
- **PDF e imágenes:** se descargan los de las próximas listas, en las dos secciones, y los demás al abrirlos. En Ajustes se puede activar «descargar todo».

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: pruebas, compilación y publicación en
GitHub Pages. Antes hay que activarlo una sola vez en *Settings → Pages → Source: GitHub Actions*.
