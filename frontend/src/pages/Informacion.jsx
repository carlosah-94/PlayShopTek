// HU-26: Políticas de privacidad y Términos y condiciones (enlaces del pie de página).
// Resumen en lenguaje simple. Antes de usar la tienda con clientes reales, lo revisa un abogado.
import { Link } from 'react-router-dom'

const TEXTOS = {
  privacidad: {
    titulo: 'Políticas de privacidad',
    partes: [
      ['Qué datos guardamos', 'Tu nombre, correo, WhatsApp y distrito; lo que compras y las reparaciones que dejas en el taller; lo que buscas en la tienda y las reseñas que escribes.'],
      ['Para qué los usamos', 'Para preparar tus pedidos y reparaciones, avisarte cuando están listos, recomendarte productos y saber qué productos traer a la tienda. No vendemos ni compartimos tus datos con otras empresas.'],
      ['Datos de pago', 'No guardamos números de tarjeta. De Yape solo guardamos el número de operación, para confirmar tu pago.'],
      ['Tus derechos', 'Según la Ley N.º 29733 de Protección de Datos Personales, puedes pedir ver, corregir o borrar tus datos. Cambia tus datos en "Mi cuenta" o escríbenos por WhatsApp al 915 152 886.'],
      ['Seguridad', 'Tu contraseña se guarda cifrada: ni siquiera la tienda puede leerla. Solo Ángel y Linda ven tus pedidos y reparaciones para atenderte.'],
    ],
  },
  terminos: {
    titulo: 'Términos y condiciones',
    partes: [
      ['Compras', 'Los precios están en soles e incluyen IGV. Las compras se pagan por la web (Yape o tarjeta) y se recogen en Av. Revolución 1420, Villa El Salvador. Separamos tu pedido 48 horas.'],
      ['Ofertas', 'Cada oferta dura los días que indica su contador y termina a la medianoche (hora de Lima). Hasta agotar stock.'],
      ['Preventas', 'La reserva asegura tu unidad para el día del lanzamiento; el resto se paga al recoger.'],
      ['Garantía', 'Los productos nuevos y los reacondicionados en nuestro taller tienen 3 meses de garantía en la tienda. Los juegos usados se prueban antes de entregarlos.'],
      ['Reparaciones', 'El diagnóstico y el precio se acuerdan por WhatsApp antes de reparar: nunca reparamos ni cobramos sin tu aceptación.'],
      ['Reclamos', 'Puedes dejar tu reclamo o queja en el Libro de Reclamaciones virtual; respondemos en un máximo de 15 días hábiles.'],
    ],
  },
}

export default function Informacion({ tema }) {
  const t = TEXTOS[tema]
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-semibold">{t.titulo}</h1>
      <div className="space-y-4 rounded-2xl border border-tinta/10 bg-superficie p-6 shadow-sm">
        {t.partes.map(([titulo, texto]) => (
          <section key={titulo}>
            <h2 className="text-lg font-medium">{titulo}</h2>
            <p className="mt-1 text-tinta/80">{texto}</p>
          </section>
        ))}
      </div>
      <p className="text-sm text-tinta/70">¿Dudas? <Link to="/mi-tienda" className="text-rosa underline">Escríbenos o visítanos</Link>. Última actualización: noviembre de 2026.</p>
    </article>
  )
}
