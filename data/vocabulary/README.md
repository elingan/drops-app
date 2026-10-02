# Vocabulario (fuente)

Un archivo por categoría. Formato por línea:

```
tipo|alemán|traducción|alt (paráfrasis/equivalente alemán)|contexto
```

- `tipo`: `w` = palabra, `p` = frase.
- `# Categoría` define la categoría de las líneas siguientes.
- `alt` y `contexto` son opcionales (dejar vacío).
- Austriacismos: `alt` lleva el equivalente alemán estándar y `contexto` dice «Austria».

Generar el JSON que usa la app:

```bash
npm run vocab:build   # → src/lib/data/vocabulary-at.json
```

Basado en el análisis del corpus de emails (≈600 mensajes, 10 años), filtrado
(sin nombres, direcciones, datos personales ni texto legal de pies de email),
corregido y completado con vocabulario B1 priorizando el alemán de Austria.
