#!/usr/bin/env bash
# =============================================================================
# Play Shop Tek · Crea el tablero Scrum en GitHub (se corre UNA sola vez)
#
# Qué hace:
#   1. Etiquetas (Must, Should, Could, Won't, épicas...).
#   2. Los 3 sprints como "milestones" (hitos con fecha de fin).
#   3. Las 19 historias de usuario como issues, cada una con criterios de
#      aceptación, puntos y definición de terminado. Más 3 tareas técnicas.
#   4. Un proyecto (tablero) con las columnas del Word:
#      Product Backlog · Sprint actual · En progreso · En revisión · Hecho
#      y un campo "Puntos".
#   5. Pone cada issue en su columna.
#
# Requisitos: GitHub CLI instalado y sesión iniciada con permiso de proyectos:
#   gh auth login            (una vez)
#   gh auth refresh -s project
#
# Uso (en Git Bash, desde la carpeta del repositorio):
#   bash scripts/crear_tablero.sh
#
# Si se corta a la mitad, se puede volver a correr: lo que ya existe no se duplica.
# =============================================================================
set -euo pipefail
export LC_ALL=C.UTF-8 MSYS_NO_PATHCONV=1   # tildes bien escritas en Windows

PROYECTO="Play Shop Tek · Scrum"
ESTADOS="Product Backlog,Sprint actual,En progreso,En revisión,Hecho"
# Carpeta temporal DENTRO del repo (ruta relativa): gh.exe de Windows no entiende /tmp de Git Bash
TMP="$(mktemp -d ./.tablero_tmp.XXXXXX)"; trap 'rm -rf "$TMP"' EXIT

paso() { printf '\n\033[1;35m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- 0. revisar
paso "Revisando GitHub CLI y la sesión"
command -v gh >/dev/null || { echo "Falta GitHub CLI. Instálalo: winget install --id GitHub.cli"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Primero inicia sesión: gh auth login"; exit 1; }
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
DUENO="${REPO%%/*}"
echo "Repositorio: $REPO"
if ! gh project list --owner "$DUENO" --limit 1 >/dev/null 2>&1; then
  echo "Falta el permiso de proyectos. Corre:  gh auth refresh -s project   y vuelve a intentar."; exit 1
fi

# ---------------------------------------------------------------- 1. etiquetas
paso "Creando etiquetas"
etiqueta() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "  · $1"; }
etiqueta "historia"            "5546E4" "Historia de usuario"
etiqueta "tarea técnica"       "0E8A16" "Trabajo técnico que no es una historia"
etiqueta "Must"                "D61F5B" "MoSCoW: imprescindible"
etiqueta "Should"              "F0A202" "MoSCoW: importante"
etiqueta "Could"               "9397AB" "MoSCoW: deseable"
etiqueta "Won't"               "6E7781" "MoSCoW: descartada por ahora"
etiqueta "Catálogo y compra"   "DE1CBB" "Épica"
etiqueta "Reparaciones"        "DE1CBB" "Épica"
etiqueta "Asistente con IA"    "DE1CBB" "Épica"
etiqueta "Gestión del negocio" "DE1CBB" "Épica"
etiqueta "Cuenta y confianza"  "DE1CBB" "Épica"

# ---------------------------------------------------------------- 2. sprints
paso "Creando los sprints (milestones)"
sprint() {  # titulo  fecha_fin_utc  descripcion
  local existentes; existentes="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')"
  if grep -qxF "$1" <<<"$existentes"; then
    echo "  · $1 (ya existía)"
  else
    gh api "repos/$REPO/milestones" -f title="$1" -f due_on="$2" -f description="$3" >/dev/null && echo "  · $1"
  fi
}
# Fin de cada sprint a las 23:59 de Lima (= 04:59 del día siguiente en UTC)
sprint "Sprint 1" "2026-10-26T04:59:59Z" "12 al 25 de octubre · Repositorio, Docker, base de datos, login por roles, inventario, catálogo y registro de reparaciones."
sprint "Sprint 2" "2026-11-09T04:59:59Z" "26 de octubre al 8 de noviembre · Carrito y pago, preventa, favoritos, rastreo, estados con aviso por WhatsApp, intereses y tablero."
sprint "Sprint 3" "2026-11-23T04:59:59Z" "9 al 22 de noviembre · Chatbot, resumen inteligente, ventas en tienda, reseñas, Libro de Reclamaciones y despliegue."

# ---------------------------------------------------------------- 3. proyecto
paso "Creando el tablero"
NUM="$(gh project list --owner "$DUENO" --format json --jq ".projects[] | select(.title==\"$PROYECTO\") | .number" | head -n1)"
if [ -z "$NUM" ]; then
  NUM="$(gh project create --owner "$DUENO" --title "$PROYECTO" --format json --jq .number)"
  echo "  · Proyecto #$NUM creado"
else
  echo "  · Proyecto #$NUM (ya existía)"
fi
gh project link "$NUM" --owner "$DUENO" --repo "$REPO" >/dev/null 2>&1 || true
PID="$(gh project view "$NUM" --owner "$DUENO" --format json --jq .id)"

NOMBRES_CAMPOS="$(gh project field-list "$NUM" --owner "$DUENO" --limit 50 --format json --jq '.fields[].name')"
if ! grep -qxF "Estado" <<<"$NOMBRES_CAMPOS"; then
  gh project field-create "$NUM" --owner "$DUENO" --name "Estado" --data-type SINGLE_SELECT \
     --single-select-options "$ESTADOS" >/dev/null && echo "  · Campo Estado (las 5 columnas)"
fi
if ! grep -qxF "Puntos" <<<"$NOMBRES_CAMPOS"; then
  gh project field-create "$NUM" --owner "$DUENO" --name "Puntos" --data-type NUMBER >/dev/null && echo "  · Campo Puntos"
fi
F_ESTADO="$(gh project field-list "$NUM" --owner "$DUENO" --limit 50 --format json --jq '.fields[] | select(.name=="Estado") | .id')"
F_PUNTOS="$(gh project field-list "$NUM" --owner "$DUENO" --limit 50 --format json --jq '.fields[] | select(.name=="Puntos") | .id')"
opcion() { gh project field-list "$NUM" --owner "$DUENO" --limit 50 --format json \
             --jq ".fields[] | select(.name==\"Estado\") | .options[] | select(.name==\"$1\") | .id"; }
declare -A OPC
for e in "Product Backlog" "Sprint actual" "En progreso" "En revisión" "Hecho"; do OPC["$e"]="$(opcion "$e")"; done

# ---------------------------------------------------------------- 4. issues
DOD='### Definición de terminado
- [ ] Cumple todos los criterios de aceptación
- [ ] Revisado por otro integrante en un pull request
- [ ] Las pruebas pasan (CI en verde)
- [ ] Aceptado por el Product Owner'

# crear_item  titulo  etiquetas  sprint  puntos  estado  cierre   (el cuerpo llega por la entrada estándar)
#   cierre: "" (abierto) · completed · "not planned"
crear_item() {
  local titulo="$1" etiquetas="$2" hito="$3" puntos="$4" estado="$5" cierre="${6:-}"
  local cuerpo="$TMP/cuerpo.md" url item
  cat > "$cuerpo"
  url="$(gh issue list --state all --limit 200 --json title,url --jq ".[] | select(.title==\"$titulo\") | .url" | head -n1)"
  if [ -z "$url" ]; then
    local args=(--title "$titulo" --body-file "$cuerpo" --label "$etiquetas")
    [ -n "$hito" ] && args+=(--milestone "$hito")
    url="$(gh issue create "${args[@]}" | tail -n1)"
    echo "  · $titulo"
  else
    echo "  · $titulo (ya existía)"
  fi
  if [ -n "$cierre" ]; then
    gh issue close "$url" --reason "$cierre" >/dev/null 2>&1 || true
  fi
  [ -z "$estado" ] && return 0
  item="$(gh project item-add "$NUM" --owner "$DUENO" --url "$url" --format json --jq .id)"
  gh project item-edit --id "$item" --project-id "$PID" --field-id "$F_ESTADO" \
     --single-select-option-id "${OPC[$estado]}" >/dev/null
  if [ -n "$puntos" ]; then
    gh project item-edit --id "$item" --project-id "$PID" --field-id "$F_PUNTOS" --number "$puntos" >/dev/null
  fi
}

# historia  id  titulo_corto  epica  prioridad  sprint(1-3)  puntos  "Como ..."   (criterios por la entrada estándar)
historia() {
  local id="$1" corto="$2" epica="$3" prio="$4" s="$5" pts="$6" texto="$7" estado="Product Backlog"
  [ "$s" = "1" ] && estado="Sprint actual"
  { printf '**Historia:** %s\n\n' "$texto"
    printf '**Épica:** %s · **Prioridad (MoSCoW):** %s · **Sprint:** %s · **Puntos:** %s\n\n' "$epica" "$prio" "$s" "$pts"
    printf '### Criterios de aceptación\n'; cat; printf '\n%s\n' "$DOD"
  } | crear_item "$id · $corto" "historia,$prio,$epica" "Sprint $s" "$pts" "$estado"
}

paso "Creando las tareas técnicas del Sprint 1"
crear_item "Tarea · Estructura base del repositorio con Docker Compose" "tarea técnica" "Sprint 1" "3" "Hecho" "completed" <<'EOF'
Carpetas `backend`, `frontend`, `docs`, `ml`, `scripts`; `.env.example`, `.gitignore`, `README.md` y `docker-compose.yml` con PostgreSQL 16, FastAPI y Adminer.

- [x] `docker compose up` levanta la base, el backend y Adminer
- [x] `http://localhost:8000/docs` responde
- [x] Subido a GitHub
EOF
crear_item "Tarea · Publicar el prototipo en GitHub Pages" "tarea técnica" "Sprint 1" "1" "Hecho" "completed" <<'EOF'
Prototipo navegable publicado para la exposición: https://carlosah-94.github.io/PlayShopTek/prototipo/

- [x] Foto oficial de la tienda en "Mi tienda"
- [x] Horario real (lun–sáb 12:00–20:00, dom 15:00–20:00) y WhatsApp de los dos asesores
- [x] Se abre desde computadora y celular
EOF
crear_item "Tarea · Modelo de datos en 3FN: diagrama ER y script SQL" "tarea técnica" "Sprint 1" "5" "En progreso" <<'EOF'
Diseñar la base de datos a partir de las pantallas del prototipo y normalizarla hasta la tercera forma normal.

- [ ] Diagrama entidad-relación (`docs/diagrama_er.pdf`)
- [ ] Script `docs/sql/01_modelo_fisico.sql` con las 31 tablas, llaves y restricciones
- [ ] Modelos en SQLAlchemy y primera migración con Alembic
- [ ] Datos de ejemplo cargados y consultas de prueba
EOF

paso "Creando las 19 historias de usuario"
historia "HU-01" "Catálogo con filtros" "Catálogo y compra" "Must" 1 5 \
  "Como cliente, quiero filtrar el catálogo por categoría, género y estado para encontrar rápido lo que busco." <<'EOF'
- [ ] Dado que entro al catálogo, cuando elijo una categoría (PS5, PS4, PS3, Máquinas, Mandos…), entonces solo veo productos de esa categoría.
- [ ] Dado que combino filtros de género y estado (nuevo, usado, reacondicionado), cuando los aplico, entonces se cumplen todos a la vez y veo cuántos resultados hay.
- [ ] Dado que busco algo que no vendemos, cuando no hay resultados, entonces veo un mensaje amable y la búsqueda queda registrada (HU-11).
- [ ] Funciona sin iniciar sesión y se ve bien en el celular.
EOF
historia "HU-02" "Ficha con fotos y tráiler" "Catálogo y compra" "Must" 1 3 \
  "Como cliente, quiero ver la ficha con fotos, tráiler, precio y stock para decidir mi compra." <<'EOF'
- [ ] Dado que abro un producto, entonces veo sus fotos, precio, estado, stock y descripción.
- [ ] Dado que el juego tiene tráiler, cuando lo toco, entonces se reproduce dentro de la ficha.
- [ ] Dado que tiene una oferta vigente, entonces veo el precio anterior tachado y el porcentaje de descuento.
- [ ] Dado que el stock es 0, entonces veo "Agotado" y el botón "Avísame cuando llegue".
EOF
historia "HU-03" "Carrito y pago con Yape o tarjeta" "Catálogo y compra" "Must" 2 8 \
  "Como cliente, quiero pagar con Yape o tarjeta y recoger en la tienda para no esperar en el local." <<'EOF'
- [ ] Dado que agrego productos al carrito, cuando cambio las cantidades, entonces el total se recalcula y no puedo pedir más que el stock disponible.
- [ ] Dado que voy a pagar, entonces solo puedo elegir Yape (con número de operación) o tarjeta, y la web nunca guarda los datos de la tarjeta.
- [ ] Dado que confirmo el pago, entonces recibo un código de pedido, veo que se recoge gratis en Av. Revolución 1420 y el stock baja.
EOF
historia "HU-04" "Preventa con reserva de S/ 50" "Catálogo y compra" "Should" 2 5 \
  "Como cliente, quiero reservar un juego en preventa con S/ 50 para asegurarlo antes de su lanzamiento." <<'EOF'
- [ ] Dado un juego en preventa, entonces veo su fecha de lanzamiento (o "por confirmar") y el botón "Reservar con S/ 50".
- [ ] Dado que reservo y pago los S/ 50, entonces la reserva aparece en "Mis compras" con su código.
- [ ] Dado que el juego llega a la tienda, entonces recibo un aviso para recogerlo y pagar el saldo.
EOF
historia "HU-05" "Favoritos y “Avísame cuando llegue”" "Catálogo y compra" "Should" 2 3 \
  "Como cliente, quiero guardar favoritos y pedir aviso cuando llegue un producto agotado para no perderlo." <<'EOF'
- [ ] Dado que inicié sesión, cuando toco el corazón de un producto, entonces se guarda en mis favoritos y lo encuentro después.
- [ ] Dado un producto agotado, cuando toco "Avísame cuando llegue", entonces queda registrado y el dueño lo ve en su tablero.
- [ ] Dado que el producto vuelve a tener stock, entonces recibo una notificación.
EOF
historia "HU-06" "Registrar equipo y falla" "Reparaciones" "Must" 1 5 \
  "Como trabajadora, quiero registrar el equipo recibido con su falla y diagnóstico para no depender de WhatsApp." <<'EOF'
- [ ] Dado que soy trabajadora o dueño, cuando registro un equipo con cliente, celular, equipo y falla, entonces se genera un código de seguimiento R-….
- [ ] Puedo agregar diagnóstico, costo y técnico; el costo no se cobra hasta que el cliente lo aprueba.
- [ ] Dado que el celular ya está registrado, entonces el sistema reconoce al cliente y no lo duplica.
EOF
historia "HU-07" "Rastreo con código" "Reparaciones" "Must" 2 3 \
  "Como cliente, quiero rastrear mi reparación con un código para saber su estado sin llamar." <<'EOF'
- [ ] Dado que tengo mi código R-…, cuando lo escribo en "Rastrea tu reparación", entonces veo el estado actual y la línea de tiempo con fechas.
- [ ] Dado un código que no existe, entonces veo un mensaje claro y nunca datos de otro cliente.
- [ ] Funciona sin iniciar sesión.
EOF
historia "HU-08" "Estados y aviso por WhatsApp" "Reparaciones" "Must" 2 5 \
  "Como trabajadora, quiero cambiar el estado de una reparación y avisar al cliente por WhatsApp cuando esté lista." <<'EOF'
- [ ] Dado que cambio el estado (Recibido → Diagnosticado → En reparación → Listo para recoger → Entregado), entonces queda en el historial con la fecha y quién lo cambió.
- [ ] Dado que pasa a "Listo para recoger", entonces se abre WhatsApp con el mensaje para el cliente (código, dirección y horario).
- [ ] El cliente ve el nuevo estado en el rastreo.
EOF
historia "HU-09" "Chatbot muestra productos" "Asistente con IA" "Must" 3 8 \
  "Como cliente, quiero preguntarle al asistente por un producto y verlo con imagen y precio dentro del chat." <<'EOF'
- [ ] Dado que pregunto por un producto ("¿tienen FIFA 26?"), entonces el asistente muestra tarjetas con imagen, precio y stock.
- [ ] El modelo de clasificación detecta la intención del mensaje; si no está seguro, ofrece hablar con un asesor por WhatsApp.
- [ ] Cada mensaje y su intención se guardan para medir el modelo, sin datos de pago.
EOF
historia "HU-10" "Chatbot ejecuta acciones" "Asistente con IA" "Should" 3 5 \
  "Como cliente, quiero pedirle al asistente que agregue un producto al carrito o me lleve a una sección." <<'EOF'
- [ ] Dado que pido "agrégalo al carrito", entonces el producto se agrega y el carrito se actualiza.
- [ ] Dado que pido ir a una sección (ofertas, reparaciones, mi tienda), entonces el asistente me lleva ahí.
- [ ] El asistente nunca completa un pago: el pago siempre lo confirma el cliente.
EOF
historia "HU-11" "Registrar búsquedas sin resultado" "Asistente con IA" "Must" 2 3 \
  "Como dueño, quiero que se registren las búsquedas sin resultado para saber qué piden los clientes." <<'EOF'
- [ ] Dado que alguien busca algo sin resultados, entonces se guarda el texto y la fecha.
- [ ] Las búsquedas parecidas se agrupan ("gta 6" y "gta vi" cuentan como lo mismo).
- [ ] El dueño ve en su tablero lo más buscado que no tenemos.
EOF
historia "HU-12" "Inventario y precios" "Gestión del negocio" "Must" 1 8 \
  "Como dueño, quiero administrar productos, stock, precios, ofertas y preventas desde un panel." <<'EOF'
- [ ] Dado que soy el dueño, entonces puedo crear y editar productos, precios, ofertas (porcentaje y días) y preventas.
- [ ] Dado que soy la trabajadora, entonces veo el inventario y el stock bajo, pero no puedo cambiar precios.
- [ ] Dado que el stock de un producto llega a su mínimo, entonces aparece en la lista "Stock bajo".
EOF
historia "HU-13" "Tablero del negocio" "Gestión del negocio" "Must" 2 8 \
  "Como dueño, quiero un tablero con ventas, reparaciones frecuentes y lo más buscado para ver cómo va el negocio." <<'EOF'
- [ ] Dado que soy el dueño, entonces veo ventas e ingresos de los últimos 7, 30 o 90 días, separados por canal (web, tienda, WhatsApp).
- [ ] Veo las reparaciones más frecuentes por tipo de falla y el mapa de calor por día y hora.
- [ ] Veo lo más buscado sin resultado y los avisos pedidos.
- [ ] La trabajadora no puede ver este tablero.
EOF
historia "HU-14" "Resumen inteligente" "Gestión del negocio" "Must" 3 13 \
  "Como dueño, quiero un resumen que me recomiende qué reponer, qué agregar y qué ofertas repetir." <<'EOF'
- [ ] Recomienda qué reponer según la demanda que predice el modelo de regresión.
- [ ] Sugiere qué productos agregar a partir de las búsquedas sin resultado agrupadas.
- [ ] Indica qué ofertas repetir según lo vendido durante cada oferta.
- [ ] Cada recomendación explica en una frase por qué la hace.
EOF
historia "HU-15" "Ventas en tienda y por WhatsApp" "Gestión del negocio" "Should" 3 5 \
  "Como dueño, quiero registrar las ventas hechas en tienda o por WhatsApp para tener todo en un solo lugar." <<'EOF'
- [ ] Dado que soy dueño o trabajadora, cuando registro una venta en tienda o por WhatsApp con productos, cantidades y medio de pago, entonces queda guardada con su código.
- [ ] El stock baja y la venta aparece en el tablero junto con las ventas web.
- [ ] Si el cliente no tiene cuenta, se genera un código para que pueda dejar su reseña (HU-17).
EOF
historia "HU-16" "Inicio de sesión por rol" "Cuenta y confianza" "Must" 1 5 \
  "Como usuario, quiero iniciar sesión y ver solo lo que mi perfil permite." <<'EOF'
- [ ] Dado un correo y contraseña correctos, entonces entro; si alguno es incorrecto, veo un mensaje que no dice cuál falló.
- [ ] El cliente ve su cuenta; la trabajadora ve taller, stock bajo y reseñas; el dueño ve todo.
- [ ] Dado que intento abrir una pantalla que no me corresponde, entonces el sistema no me deja (también desde la API).
- [ ] Las contraseñas se guardan cifradas, nunca en texto plano.
EOF
historia "HU-17" "Reseñas verificadas" "Cuenta y confianza" "Should" 3 5 \
  "Como cliente, quiero reseñar una compra o reparación entregada para compartir mi experiencia." <<'EOF'
- [ ] Solo puede reseñar quien compró o recibió su reparación entregada (con su cuenta o con el código de reseña).
- [ ] Elijo de 1 a 5 estrellas y escribo un comentario; el dueño puede responderlo.
- [ ] La calificación de cada producto es el promedio de sus reseñas.
EOF
historia "HU-18" "Libro de Reclamaciones" "Cuenta y confianza" "Must" 3 3 \
  "Como cliente, quiero registrar un reclamo en el Libro de Reclamaciones, como exige la normativa peruana." <<'EOF'
- [ ] El formulario pide los datos que exige la norma: nombre, DNI, domicilio, correo, tipo (reclamo o queja), detalle y pedido.
- [ ] Al enviarlo recibo un código LR-… y una copia por correo.
- [ ] El dueño ve los reclamos y cuántos días le quedan para responder dentro del plazo legal.
EOF

# HU-19: se registra y se cierra como "no planificada" (decisión del dueño)
crear_item "HU-19 · Entrega en estación del tren" "historia,Won't,Catálogo y compra" "" "" "" "not planned" <<'EOF'
**Historia:** Como cliente, quiero recibir mi pedido en la estación del tren para no ir hasta la tienda.

**Épica:** Catálogo y compra · **Prioridad (MoSCoW):** Won't

**Descartada.** En la reunión de validación, el dueño pidió no incluir delivery en la web. La página ofrece solo recojo gratis en la tienda.
EOF

paso "¡Listo!"
echo "Abre tu tablero:  https://github.com/users/$DUENO/projects/$NUM"
echo "Falta un paso a mano: crear la vista de columnas (Board → Column by: Estado)."
