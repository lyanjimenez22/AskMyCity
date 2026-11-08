# Estado de la integración con sponsors

Verificado en vivo desde la app (modo administrador), 8 de noviembre de 2026:

- **Base44:** app pública con 24 fichas, cuestionario y 3 idiomas. ✅
- **Swarms API:** flujo secuencial (SequentialWorkflow) con dos agentes, Router → Evidence, que elige y verifica el id de la ficha. Respuesta en ~2.5 s, costo ~$0.0213 por consulta. ✅
  - GraphWorkflow requiere acceso premium (403 `premium_access_required`), por eso usamos el flujo secuencial.
- **Prune API:** las llamadas de IA pasan por `https://api.withprune.com/v1/chat/completions` y devuelven recibo firmado (`pruneReceipt: true`), ~8 s con un modelo gratuito de OpenRouter. ✅
- Resultado combinado en modo demo: `routing: "sponsors"`, `sponsors.swarms: "verified"`, `sponsors.prune: "verified"`.

Cómo funciona el modo demo: solo corre si el usuario es administrador, con `demo: true` y una pregunta de ejemplo aprobada. El público usa únicamente el catálogo. Ninguna clave está en este repositorio; viven como Secrets de Base44 (ver `.env.example`).

Pendiente: revisión del creole por un hablante nativo.
