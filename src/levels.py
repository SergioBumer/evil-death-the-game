import json, sys

def new(w, h): return [['.'] * w for _ in range(h)]
def rect(g, x1, y1, x2, y2, c='#'):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            g[y][x] = c
def ground(g, x1, x2, top, c='#'): rect(g, x1, top, x2, len(g) - 1, c)
def put(g, x, y, c): g[y][x] = c
def rows(g): return [''.join(r) for r in g]

L = []

# ---------- NIVEL 1: El Callejón Oscuro (sin poderes: solo trampas) ----------
g = new(80, 16)
ground(g, 0, 12, 13); put(g, 2, 12, 'S')
ground(g, 13, 18, 11)
ground(g, 22, 30, 11)
ground(g, 31, 36, 7); put(g, 34, 6, 'H')
ground(g, 37, 48, 13)
for x in (41, 42, 43): put(g, x, 12, '^')
rect(g, 49, 13, 54, 13, '=')
ground(g, 55, 79, 13)
put(g, 56, 12, 'C'); put(g, 59, 12, 'P')
rect(g, 64, 0, 79, 8); rect(g, 64, 9, 64, 12, 'G')
rect(g, 79, 0, 79, 15)
put(g, 75, 12, 'M')
put(g, 26, 10, 'E')   # poser que hay que esquivar (todavía no hay ataque)
L.append(dict(rows=rows(g), signs=[
    [5, 12, "← → para correr. Z, ESPACIO o el botón SALTO para saltar."],
    [23, 10, "Aún no tienes poderes: salta por encima de los posers."],
    [29, 10, "Mantén → contra un borde para AGARRARTE. ↑ o SALTO para trepar."],
    [39, 12, "Pinchos oxidados. Mejor no pisarlos."],
    [47, 12, "Ese piso está suelto: ¡crúzalo sin detenerte!"],
    [58, 12, "Pisa la placa para abrir la reja."],
]))

# ---------- NIVEL 2: La Bodega del Ensayo (riff) ----------
g = new(90, 16)
ground(g, 0, 24, 13); put(g, 2, 12, 'S'); put(g, 12, 12, 'E')
ground(g, 25, 28, 10)
ground(g, 29, 40, 10); put(g, 35, 9, 'E')
ground(g, 44, 55, 10); put(g, 49, 9, '^'); put(g, 53, 9, 'H')
ground(g, 56, 70, 13); put(g, 57, 12, 'C'); put(g, 61, 12, 'E'); put(g, 67, 12, 'E'); put(g, 64, 8, 'F')
ground(g, 71, 74, 9)
ground(g, 75, 80, 9); put(g, 77, 8, 'P')
ground(g, 81, 89, 13)
rect(g, 84, 0, 84, 8); rect(g, 84, 9, 84, 12, 'G')
rect(g, 89, 0, 89, 15)
put(g, 87, 12, 'M')
# corazón azul: repisa alta sobre la plataforma (agarre)
rect(g, 32, 6, 36, 6); put(g, 34, 5, 'V')
L.append(dict(rows=rows(g), signs=[
    [5, 12, "Ahora tienes RIFF: X o el botón RIFF para atacar con la guitarra."],
    [58, 12, "La placa de esta bodega está arriba. Trepa."],
]))

# ---------- NIVEL 3: El Túnel del Metro (doble salto) ----------
g = new(95, 16)
ground(g, 0, 12, 13); put(g, 2, 12, 'S')
ground(g, 19, 30, 13); put(g, 24, 12, 'E')
ground(g, 31, 45, 8); put(g, 40, 5, 'F'); put(g, 43, 7, 'H')
rect(g, 52, 6, 55, 7)
rect(g, 62, 8, 64, 8, '=')
rect(g, 68, 8, 72, 9); put(g, 70, 7, 'C')
ground(g, 79, 94, 10)
for x in (84, 85, 86): put(g, x, 9, '^')
put(g, 81, 9, 'H'); put(g, 91, 9, 'M')
rect(g, 94, 0, 94, 15)
# corazón azul: repisa flotante sobre el foso (doble salto + agarre)
rect(g, 47, 3, 48, 3); put(g, 47, 2, 'V')
L.append(dict(rows=rows(g), signs=[
    [5, 12, "DOBLE SALTO: pulsa SALTO otra vez en el aire."],
    [29, 12, "¿Muy alto? Doble salto y agárrate del borde."],
]))

# ---------- NIVEL 4: La Fábrica de Amplis (dash) ----------
g = new(100, 16)
ground(g, 0, 14, 13); put(g, 2, 12, 'S')
rect(g, 15, 0, 16, 8); rect(g, 15, 9, 16, 12, 'B')
ground(g, 15, 30, 13); put(g, 22, 12, 'E'); put(g, 27, 12, 'E')
ground(g, 39, 55, 13); put(g, 41, 12, 'C'); put(g, 48, 8, 'F')
rect(g, 56, 0, 65, 10); ground(g, 56, 70, 13); rect(g, 60, 11, 60, 12, 'B'); put(g, 63, 12, 'E')
ground(g, 71, 74, 10)
ground(g, 75, 78, 7); put(g, 77, 6, 'H')
ground(g, 79, 99, 4)
for x in (85, 86, 87): put(g, x, 3, '^')
put(g, 90, 3, 'P')
rect(g, 95, 0, 95, 3, 'G')
put(g, 98, 3, 'M')
# corazón azul: repisa sobre el hueco grande (doble salto + dash)
rect(g, 34, 8, 35, 8); put(g, 34, 7, 'V')
L.append(dict(rows=rows(g), signs=[
    [5, 12, "DASH: C o el botón DASH. Rompe muros agrietados."],
    [29, 12, "Hueco enorme: salta, doble salto y DASH en el aire."],
]))

# ---------- NIVEL 5: La Torre del Feedback (salto de pared) ----------
g = new(40, 40)
rect(g, 0, 0, 0, 39); rect(g, 39, 0, 39, 39); ground(g, 0, 39, 37)
put(g, 3, 36, 'S'); put(g, 9, 36, 'E')
rect(g, 14, 22, 14, 34)          # muro W1
rect(g, 18, 18, 18, 36)          # muro W2
rect(g, 1, 22, 14, 23)           # piso intermedio
put(g, 10, 21, 'H'); put(g, 8, 21, 'C')
rect(g, 4, 6, 4, 19)             # muro del segundo pozo
rect(g, 4, 6, 25, 7)             # plataforma superior
rect(g, 19, 8, 38, 36)           # roca derecha
rect(g, 26, 8, 28, 9, '.')
for x in (26, 27, 28): put(g, x, 9, '^')
rect(g, 29, 6, 38, 7)
put(g, 8, 5, 'C'); put(g, 12, 5, 'E'); put(g, 16, 5, '^'); put(g, 17, 5, '^'); put(g, 21, 3, 'F')
put(g, 31, 5, 'H'); put(g, 35, 5, 'M')
# corazón azul: nicho secreto en la pared del pozo, justo sobre la salida (cruzar el pozo saltando)
rect(g, 18, 19, 21, 20, '.'); put(g, 20, 20, 'V')
L.append(dict(rows=rows(g), signs=[
    [5, 36, "SALTO DE PARED: en el aire, tocando un muro, pulsa SALTO."],
    [12, 21, "Otro pozo a la izquierda. Rebota hasta arriba."],
]))

# ---------- NIVEL 6: La Catedral del Ruido (riff a distancia) ----------
g = new(110, 16)
ground(g, 0, 20, 13); put(g, 2, 12, 'S')
for x in (12, 13, 15, 16): put(g, x, 12, '^')
put(g, 14, 12, 'O')
rect(g, 21, 0, 21, 8); rect(g, 21, 9, 21, 12, 'G')
ground(g, 21, 34, 13); put(g, 26, 12, 'E'); put(g, 31, 12, 'E')
ground(g, 35, 44, 8); put(g, 40, 5, 'F')
ground(g, 53, 60, 8); put(g, 55, 7, 'C')
rect(g, 61, 0, 62, 3); rect(g, 61, 4, 62, 7, 'B')
ground(g, 61, 75, 8); put(g, 64, 7, 'E'); put(g, 68, 7, 'E')
for x in (72, 73, 74): put(g, x, 7, '^')
put(g, 75, 7, 'O')
rect(g, 76, 0, 76, 3); rect(g, 76, 4, 76, 7, 'G')
ground(g, 76, 80, 8)
ground(g, 81, 109, 13); put(g, 83, 12, 'H'); put(g, 86, 12, 'E'); put(g, 92, 9, 'F'); put(g, 97, 12, 'E')
put(g, 106, 12, 'M')
rect(g, 109, 0, 109, 15)
# corazón azul: repisa alta sobre el hueco (doble salto + agarre)
rect(g, 47, 3, 48, 3); put(g, 47, 2, 'V')
L.append(dict(rows=rows(g), signs=[
    [5, 12, "RIFF A DISTANCIA: tus riffs lanzan notas. Dispárale al parlante para abrir la reja."],
    [57, 7, "Un muro agrietado. Ya sabes qué hacer."],
]))

# ---------- NIVEL 7: El Gran Festival (jefe) ----------
g = new(34, 17)
rect(g, 0, 0, 0, 16); rect(g, 33, 0, 33, 16); ground(g, 0, 33, 14)
rect(g, 5, 10, 9, 10); rect(g, 24, 10, 28, 10); rect(g, 13, 6, 20, 6)
put(g, 3, 13, 'S'); put(g, 17, 2, 'K'); put(g, 7, 9, 'H'); put(g, 26, 9, 'H')
put(g, 5, 9, 'V'); put(g, 28, 9, 'V')   # 2 vidas extra para la pelea final
L.append(dict(rows=rows(g), signs=[]))

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == 'show':
        for i, l in enumerate(L):
            print(f'--- LEVEL {i+1}')
            for r in l['rows']: print(r)
    else:
        print(json.dumps(L, ensure_ascii=False))
