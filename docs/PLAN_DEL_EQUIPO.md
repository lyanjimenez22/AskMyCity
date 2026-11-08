# AskMyCity — Proyecto SharkByte 2026

**Última actualización: domingo 8 de nov, 4:55 a.m. ET.**
**Hacking termina 10:00 a.m. · Devpost cierra 11:00 a.m. · Congelar cambios 9:30 a.m. · Enviar a las 10:30 a.m.**

## 👋 LEE ESTO PRIMERO

### En 30 segundos
**AskMyCity** es una web donde un residente de **Miami** o **Miami Gardens** escribe o dice su problema **en su idioma** (español, inglés, creole haitiano) y recibe **una tarjeta**: título, resumen corto, **un paso**, **enlace oficial**, **teléfono** y **audio**. Nada inventado: la IA solo **elige una ficha** del catálogo; nunca escribe la respuesta. Si no hay ficha → contacto oficial (311 Miami / 305-622-8000 Gardens).

Premios: **Best Overall**, **Base44 Challenge**, **Best Use of Swarms API**, **Best Use of Prune API**.
Base44 Challenge: app que resuelva un problema de la comunidad local. AskMyCity encaja directo.
Requisito de Devpost: **repositorio de GitHub** (aún no creado).

### Por qué las decisiones
- **Problema:** la info de la ciudad existe pero está dispersa, en inglés legal y organizada por departamento, no por necesidad.
- **Web responsive** (no app de tienda): sin instalar, funciona en cualquier dispositivo, los jueces la abren al instante.
- **Swarms:** agentes de verdad (Router → Evidence). **Prune:** proxy de las llamadas de IA con recibo de costo.
- **Catálogo cerrado:** garantiza que no se inventen enlaces ni requisitos.

### Brechas (cómo organizamos el trabajo; el usuario solo ve una caja)
- **A. Info en demasiados lugares** ✅ HECHO (tarjetas por problema).
- **B. Programas escondidos** ✅ HECHO (cuestionario: ciudad, necesidad, inquilino/dueño, edad 62+).
- **C. Explicar documentos/PDF** ⏭️ NO se construyó → se presenta como siguiente paso.
- **D. Decisiones grandes (bonos, arriendos)** ⏭️ siguiente paso.
- **E. Reuniones a horas en que la gente trabaja** ⏭️ siguiente paso.
- **F. La gente habla pero no ve qué pasó** ⏭️ siguiente paso.

Datos del problema: votó 21.68% en la elección municipal de Miami 2025; ~35,300 hispanohablantes y ~7,900 de creole/francés en casa en Miami Gardens (ACS 2020–2024, confirmar en census.gov o no usar).

---

## 1. Stack y arquitectura (FINAL)

**Base44 + Swarms + Prune.** Nadie cambia de herramienta sin avisar.

- **App publicada (pública):** https://ask-miami-now.base44.app
- **Base44:** pantalla (ciudad, idioma, pregunta/voz, cuestionario) + entidad `Resource` con **24 fichas** (13 Miami, 11 Miami Gardens).
- **Función backend `askCity`** (Deno). Hoy en producción: versión de **dos archivos** (entry + worker). Existe versión de un solo archivo (`askCity.function.js`), **no se cambia** hasta después de entregar.
- **Devuelve:** `{status,title,summary,nextStep,routing,source:{id,url,phone,checked}}`.
- **Reglas en código:** emergencia (palabra "emergencia", 911, etc.) → 911; temas fuera de cobertura o de otra ciudad → contacto oficial; empates entre fichas → se evitan con términos específicos.
- **Modo sponsors (solo admin):** `demo: true` usa Swarms + Prune. Requiere secretos `SWARMS_API_KEY`, `PRUNE_API_KEY`, `SPONSOR_DEMO_TOKEN`. Cuando Swarms/Prune no están, la app funciona con el emparejamiento local por palabras clave.
- **Audio:** voz del navegador.

```
Residente → Base44 (pantalla) → askCity → ficha del catálogo (22) → tarjeta
                                   └─(admin demo)→ Swarms (Router→Evidence) vía Prune (recibo)
```

### Catálogo: UNA sola fuente de verdad
- Fichas: `flood, pothole, sidewalk, rent, citycares, work, trash, dumping, overgrown, abandoned, gardens-code, gardens-alerts, gardens-drainage, senior-rent, section8, homebuyer, gardens-senior-home, jobs-miami, gardens-bulky, gardens-freebee, gardens-university, gardens-housing`.
- Formato: id, city, kind (service/program), terms, url, phone, checked, textos es/en/ht. Programas además: need (housing/work/home_repair/education), tenure (any/renter/owner), min_age.
- **Dueño del catálogo: Ronald.** Cambios nuevos pasan por él; Miguel los carga en Base44. No hay otros catálogos paralelos.
- Pendientes de verificar por Ronald: ficha `work` (Gardens) y `gardens-drainage`, y teléfonos de las fichas nuevas de Gardens.

---

## 2. Reglas que NO se rompen
- **Nada inventado.** Todo de miami.gov o miamigardens-fl.gov, con enlace. Sin datos falsos ni en el demo.
- La IA **elige la ficha, nunca escribe la respuesta**.
- Si no sabe: contacto oficial (**311** Miami · **305-622-8000** Gardens).
- Nunca dice "calificas": "este programa podría ser para ti".
- Frases cortas, cero términos legales, un paso a la vez.
- **Claves API: NUNCA en el chat ni en Git.** Solo en Base44 → Settings → Secrets. (Una clave de Swarms se pegó en un chat: **rotarla después del hackathon**.)

---

## 3. Reparto del equipo (3 personas)

| Persona | Qué hace |
|---|---|
| **Miguel** — App en Base44 | Pantalla, entidad Resource, función askCity, publicar (Public), probar en incognito. |
| **Lyan** — Swarms + Prune | Claves, workflow Router→Evidence, pasar llamadas por Prune, recibo. Crear `PRUNE_API_KEY`, confirmar acceso premium a GraphWorkflow (si da 403, usar agentes sin GraphWorkflow). |
| **Ronald** — Datos + Entrega | Catálogo (dueño), probar en teléfono, repositorio GitHub, borrador Devpost, guion y video. |

Reglas: este archivo manda; no hay funciones nuevas (ideas → "siguientes pasos"); cada uno toca solo lo suyo; avisar si algo se bloquea más de 1 hora.

---

## 4. Estado actual (4:55 a.m.)

**Hecho ✅**
- App pública con 24 fichas y `askCity` publicada (9:41 UTC). Pruebas OK: empleo Miami, basura tirada, inundación Gardens, "pasaporte" → contacto de la ciudad.
- Cuestionario con Vivienda, Empleo, Arreglar mi casa.
- Español/inglés/creole, audio del navegador, reglas de emergencia y de fuera de cobertura.
- Base44 confirmó: la clave pegada no cambió código ni datos.

**En curso ⏳**
- Miguel pidió a Base44 agregar la opción **"Estudiar"** al cuestionario (solo Miami Gardens). Probar: Gardens · Ninguno · No · Estudiar → "Estudiar con la alianza de universidades · 305-622-8000 ext. 2301".

**Pendiente, en orden**
- [ ] **1. Secretos:** hoy solo existe `OPENAI_API_KEY`. Revisar si contiene la clave de Swarms; si sí, borrarla y crear `SWARMS_API_KEY`. Crear `PRUNE_API_KEY` y `SPONSOR_DEMO_TOKEN` (texto aleatorio inventado).
- [ ] **2. Probar el modo sponsors** (admin): `miami`, `en`, "the road in front of my house has a big hole", `demo: true` → esperado `pothole`, `routing: sponsors`, `pruneReceipt: true`.
- [ ] **3. Re-publicar (Public) y probar en incognito** y desde un teléfono.
- [ ] **4. Repositorio GitHub** (Ronald) con README y el código de `askCity` + `resources`; **sin claves**.
- [ ] **5. Devpost + video** (Ronald): grabar al final, cuando los sponsors funcionen. Enviar 10:30 a.m.
- [ ] Revisión del creole por un hablante.
- [ ] Verificar fichas pendientes (`work`, `gardens-drainage`, teléfonos nuevos).
- [ ] Actualizar la lista de "siguientes pasos" en el pitch (C, D, E, F).

---

## 5. Sponsors

### Swarms
- Base: `https://api.swarms.world` · Header `x-api-key` · Claves: cloud.swarms.world/api-keys
- Agentes en cadena **Router → Evidence**; el resultado sale en `outputs.Evidence`.
- GraphWorkflow es premium: confirmar acceso (403 = no).
- Mostrar en el demo el costo/uso que devuelve.

### Prune
- Proxy de IA: `https://api.withprune.com/v1/chat/completions`, `Bearer prune_...`.
- Necesita un proveedor conectado en Connect → Providers.
- Recibo en `prune_metadata.receipt_signature`. Argumento del pitch: "gratis para el residente, barato para la ciudad".

---

## 6. Fuentes oficiales (solo estas)

**Miami** (miami.gov): /Housing-Assistance · /My-Home-Neighborhood/Solve-a-Problem · Tel 311 o 305-468-5900.
**Miami Gardens** (miamigardens-fl.gov): /101/Services · /244/Resident-Services · /945/CityCares · /225/Residents-Small-Business-Programs · /145/Sign-Up-For · Tel 305-622-8000 (lun–jue, 7am–7pm).

---

## 7. Demo (2 minutos)

1. Problema en 20 s con datos reales.
2. Español: "mi calle se inunda" → tarjeta con enlace, teléfono y audio.
3. Cuestionario: Miami Gardens → empleo / vivienda / estudiar → programa oficial.
4. Cambiar idioma (inglés/creole) y una pregunta fuera de cobertura → contacto oficial (la IA no inventa).
5. Mostrar Swarms + recibo de Prune (modo admin).
6. Cerrar con C, D, E, F como siguientes pasos.

---

## 8. Glosario
- **Ficha/tarjeta:** entrada del catálogo / formato fijo de respuesta.
- **Agente:** modelo de IA con una instrucción específica.
- **Caché (Prune):** pregunta repetida → respuesta guardada, sin pagar el modelo.
- **Responsive:** la misma web se adapta a teléfono, tablet y computadora.

**Al terminar algo, márcalo en la sección 4.**
