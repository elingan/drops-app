# Vocabulario (fuente)

Un archivo por categoría. Formato por línea:

```
tipo|alemán|traducción|alt (paráfrasis/equivalente alemán)|contexto[|ejemplo|traducción del ejemplo]
```

- `tipo`: `w` = palabra, `p` = frase.
- `# Categoría` define la categoría de las líneas siguientes.
- `alt` y `contexto` son opcionales (dejar vacío).
- `ejemplo` y su traducción van juntos (o ninguno): una frase corta de nivel B1 con la palabra, en
  alemán de Austria si es un austriacismo. Solo las palabras (`w`) llevan ejemplo, las frases no.
  Las líneas sin ejemplo siguen teniendo 5 campos.
- Austriacismos: `alt` lleva el equivalente alemán estándar y `contexto` dice «Austria».

Generar el JSON que usa la app:

```bash
npm run vocab:build   # → src/lib/data/vocabulary-at.json
npm run audio:build   # MP3 con ElevenLabs, ver README.md → Audio
```

Basado en el análisis del corpus de emails (≈600 mensajes, 10 años), filtrado
(sin nombres, direcciones, datos personales ni texto legal de pies de email),
corregido y completado con vocabulario B1 priorizando el alemán de Austria.
