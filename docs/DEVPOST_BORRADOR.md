# Borrador de Devpost: AskMyCity

**Nombre:** AskMyCity
**Tagline:** Una caja, tu idioma, la respuesta oficial de tu ciudad.
**Enlace de la app:** https://ask-miami-now.base44.app
**Repositorio:** [PEGAR LINK DE GITHUB]
**Premios:** Best Overall, Base44 Challenge, Best Use of Swarms API, Best Use of Prune API

## Inspiración
La información de la ciudad existe, pero está en muchas plataformas, en inglés legal y organizada por departamento. Revisamos miami.gov y miamigardens-fl.gov: Miami usa sistemas separados para agendas, video, 311 y elecciones; Miami Gardens usa CivicWeb, CityCares y Everbridge. En la elección municipal de Miami de 2025 votó 21.68% de los registrados. En Miami Gardens unas 35,300 personas hablan español en casa y unas 7,900 francés o creole haitiano (ACS 2020-2024) [VERIFICAR cifras en census.gov o quitarlas].

## Qué hace
Un residente de Miami o Miami Gardens escribe o dice su problema en español, inglés o creole haitiano y recibe una tarjeta con qué significa, un solo paso, el enlace oficial, un teléfono y audio. Para programas hay un cuestionario corto (vivienda, empleo, arreglar mi casa, estudiar). Responde también cuándo y dónde son las reuniones de la Comisión y del Concejo.

## Reglas que cumplimos
- Catálogo cerrado de 24 fichas oficiales con fecha de verificación. Nada inventado.
- La IA solo elige una ficha. No escribe la respuesta ni crea enlaces.
- Si no sabe, manda al contacto oficial (311 / 305-622-8000). Si parece emergencia, indica 911.
- Nunca dice "calificas".

## Cómo lo construimos
- **Base44:** toda la app y la función backend `askCity`. (Base44 Challenge)
- **Swarms API:** agentes Router → Evidence que eligen y verifican el id de la ficha. [CONFIRMAR estado real con Lyan]
- **Prune API:** proxy de las llamadas de IA con recibo de costo. [CONFIRMAR estado real con Lyan]

## Retos
Tres catálogos distintos que unificamos en uno solo; términos ambiguos entre fichas (basura vs basura tirada); el creole, que debe revisar un hablante nativo [PENDIENTE]; y límites de acceso de las APIs de los sponsors [DESCRIBIR LO QUE PASÓ, con honestidad].

## Lo que sigue
Explicar documentos oficiales (PDF/enlaces) en el idioma de la persona, decisiones grandes como bonos, resúmenes de reuniones públicas y seguimiento de reportes con datos públicos del 311.

## Hecho con
Base44, Swarms API, Prune API, JavaScript (Deno).
