"""TEMPORAL (carril L-01): compara dos fotos de /api/dev/comparar-liquidacion.
Uso: python scripts/comparar_liquidacion.py antes despues   (archivos en .next/comparar)
Ignora las marcas de hora. Sale con 1 si hay diferencias."""
import json, sys

def carga(n):
    return json.load(open(f".next/comparar/{n}.json", encoding="utf-8"))

def limpia(x):
    if isinstance(x, dict):
        return {k: limpia(v) for k, v in x.items() if "generado" not in k.lower() and k not in ("hoyISO",)}
    if isinstance(x, list):
        return [limpia(v) for v in x]
    return x

def difs(a, b, ruta=""):
    if type(a) != type(b):
        yield f"{ruta}: {str(a)[:80]} != {str(b)[:80]}"
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: yield f"{ruta}/{k}: falta en antes"
            elif k not in b: yield f"{ruta}/{k}: falta en despues"
            else: yield from difs(a[k], b[k], f"{ruta}/{k}")
    elif isinstance(a, list):
        if len(a) != len(b): yield f"{ruta}: largo {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)): yield from difs(x, y, f"{ruta}[{i}]")
    elif a != b:
        yield f"{ruta}: {a} != {b}"

lista = list(difs(limpia(carga(sys.argv[1])), limpia(carga(sys.argv[2]))))
print(f"{len(lista)} diferencias")
for l in lista[:40]: print(" ", l)
sys.exit(1 if lista else 0)
