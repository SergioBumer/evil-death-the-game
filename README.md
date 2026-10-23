# La Gira Maldita — un juego de Evil Death

Plataformas 2D estilo *Prince of Persia* hecho en HTML5 Canvas, sin dependencias ni build obligatorio. Todo el juego vive en `index.html`.

## Historia
El Silenciador, un productor que odia la distorsión, se robó el ruido de Bogotá y dispersó a la banda. El metalero recorre 6 niveles; al final de cada uno rescata a un músico, recibe su objeto y gana un poder. El nivel 7 es el jefe final.

| Nivel | Músico | Objeto | Poder que gana |
|---|---|---|---|
| 1 · El Callejón Oscuro | Guitarrista de backup | Púa de plata | Riff (ataque) |
| 2 · La Bodega del Ensayo | Baterista | Baquetas de acero | Doble salto |
| 3 · El Túnel del Metro | Guitarra líder I | Pedal de distorsión | Dash (rompe muros agrietados) |
| 4 · La Fábrica de Amplis | Bajista | Cuerda de bajo | Salto de pared |
| 5 · La Torre del Feedback | Guitarra líder II | Pedal wah-wah | Riff a distancia (activa parlantes) |
| 6 · La Catedral del Ruido | Vocalista | Micrófono maldito | Grito gutural |
| 7 · El Gran Festival | — | — | Jefe: El Silenciador |

Mecánicas tipo Prince of Persia: agarrarse de bordes y trepar, pinchos, pisos que se caen, placas que abren rejas, daño por caídas altas y amplificadores como puntos de control.

## Controles
- Teclado: ← → correr · Z/Espacio saltar · ↑ trepar · ↓ soltarse · X riff · C/Shift dash · V grito · P pausa · M sonido
- Celular: botones en pantalla (en horizontal)

## Desplegar en Vercel
**Ya está preparado:** el proyecto `evil-death-gira-maldita` existe en tu cuenta de Vercel y esta carpeta ya está vinculada (`.vercel/project.json`). Solo haz doble clic en `desplegar.cmd` (la primera vez te pide iniciar sesión en Vercel en el navegador). Queda en https://evil-death-gira-maldita.vercel.app

**Opción A — GitHub (recomendada):**
1. Sube esta carpeta a un repositorio.
2. En vercel.com → *Add New → Project* → importa el repo.
3. Framework preset: **Other**. Build command: vacío. Output directory: `.` (raíz). *Deploy*.

**Opción B — CLI:**
```bash
npm i -g vercel
cd evil-death-juego
vercel          # vista previa
vercel --prod   # producción
```

## Música
Todos los niveles suenan con **"Herencia maldita"** de Evil Death convertida a 8 bits (`music/herencia-maldita-8bit.mp3`): mono, muestreo a 11 kHz con retención (el "aliasing" de consola vieja) y 6 bits de resolución. La canción sigue sonando entre niveles. Si el archivo no carga, el juego usa el riff sintetizado de respaldo.

Para convertir otra canción:
```bash
python3 tools_8bit.py "mi-cancion.mp3" music/mi-cancion-8bit.mp3
```
(requiere ffmpeg, numpy y scipy). En `tools_8bit.py` puedes cambiar `BITS` (menos bits = más sucio) y `DOWN` (más alto = más grave y "consola"). Luego cambia `SONG_URL` en `src/game.src.html` y corre `python3 build.py`.

**Importante al desplegar:** sube también la carpeta `music/`, no solo `index.html`.

## Personalizar
- **Logo:** está en `assets/logo-evil-death.png` (blanco con fondo transparente). `build.py` lo incrusta dentro de `index.html`, así que el sitio sigue siendo un solo archivo.
- **Nombres reales de los músicos:** en `src/game.src.html`, constante `BAND`, llena el campo `name` (ej. `name:'Andrés'`). El juego mostrará "Rescataste a Andrés (baterista)".
- **Niveles:** se diseñan en `src/levels.py` con funciones simples (`ground`, `rect`, `put`).
  Leyenda de tiles: `#` piedra · `=` piso suelto · `^` pinchos · `B` muro agrietado · `G` reja · `P` placa · `O` parlante (se activa con riff a distancia) · `S` inicio · `E` poser · `F` nota desafinada · `H` corazón rojo (cura) · `V` corazón azul (+1 vida máxima, una sola vez) · `C` amplificador (checkpoint) · `M` músico · `K` jefe.
- Después de editar, reconstruye `index.html`:
  ```bash
  python3 build.py
  ```
  También puedes editar los mapas directamente dentro de `index.html` (constante `LEVEL_DATA`), aunque se sobrescriben si vuelves a correr el build.

El progreso se guarda en el navegador (localStorage).
