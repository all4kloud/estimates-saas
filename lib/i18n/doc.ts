// Textos que ve el CLIENTE del negocio (PDF, link público, SMS, email). Idioma del documento.
import type { Lang } from '../types';

export interface MsgData {
  first: string; owner: string; co: string; num: string; items: string; lines: string; total: string;
  valid: string; payment: string; phone: string; link: string;
}

const en = {
  estimate: 'ESTIMATE', invoice: 'INVOICE', no: 'No.', date: 'Date', validUntil: 'Valid until', due: 'Due', dueOnReceipt: 'Upon receipt',
  preparedFor: 'PREPARED FOR', billTo: 'BILL TO', desc: 'Description', qty: 'Qty', price: 'Price', amount: 'Amount',
  subtotal: 'Subtotal', tax: 'Tax', total: 'Total', totalDue: 'Total due', notes: 'Notes', payment: 'Payment options', terms: 'Terms',
  accept: 'Customer acceptance', signature: 'Signature', sigDate: 'Date', thanks: 'Thank you for your business!', paid: 'PAID',
  file: { estimate: 'Estimate', invoice: 'Invoice' },
  // página pública
  acceptBtn: 'Accept estimate', declineBtn: 'Decline', yourName: 'Your full name', acceptLegal: 'By accepting, you approve the work and prices described above.',
  acceptedOn: 'Accepted by {name} on {date}', declinedOn: 'Declined on {date}', declineReason: 'Reason (optional)',
  confirmDecline: 'Confirm decline', thanksAccept: 'Thank you! We will contact you shortly to schedule the work.',
  payCard: 'Pay {total} by card', paidOn: 'Paid on {date}', thanksPaid: 'Payment received. Thank you!', downloadPdf: 'Download PDF',
  questions: 'Questions? Call or text', switchLang: 'Ver en español', expired: 'This estimate expired on {date}. Contact us for an updated price.',
  notFound: 'This document is not available.', voided: 'This document was canceled.', processing: 'Processing…',
  // mensajes
  smsEst: (d: MsgData) => `Hi ${d.first}, this is ${d.owner} with ${d.co}. Your estimate ${d.num} for ${d.total} is ready. View and accept it here: ${d.link}`,
  smsInv: (d: MsgData) => `Hi ${d.first}, thank you for choosing ${d.co}! Invoice ${d.num} for ${d.total} is ready. View or pay here: ${d.link}`,
  subjEst: (d: MsgData) => `Estimate ${d.num} from ${d.co}`, subjInv: (d: MsgData) => `Invoice ${d.num} from ${d.co}`,
  mailEst: (d: MsgData) => `Hi ${d.first},\n\nThank you for the opportunity. Here is your estimate ${d.num}:\n\n${d.lines}\n\nTotal: ${d.total}\nValid until: ${d.valid}\n\nYou can review and accept it online:\n${d.link}\n\nThe PDF is attached. Just reply to this email or call ${d.phone} with any questions.\n\nBest regards,\n${d.owner}\n${d.co}`,
  mailInv: (d: MsgData) => `Hi ${d.first},\n\nThank you for choosing ${d.co}. Here is your invoice ${d.num}:\n\n${d.lines}\n\nTotal due: ${d.total}\n\nView or pay online:\n${d.link}\n\n${d.payment}\n\nThe PDF is attached. Questions? Reply to this email or call ${d.phone}.\n\nBest regards,\n${d.owner}\n${d.co}`,
  viewOnline: 'View online',
  notifyAccepted: (num: string, name: string) => `Estimate ${num} was accepted by ${name}`,
  notifyDeclined: (num: string) => `Estimate ${num} was declined`,
  notifyPaid: (num: string, total: string) => `Invoice ${num} was paid by card (${total})`,
};
type DocDict = typeof en;

const es: DocDict = {
  estimate: 'ESTIMADO', invoice: 'FACTURA', no: 'No.', date: 'Fecha', validUntil: 'Válido hasta', due: 'Vence', dueOnReceipt: 'Al recibir',
  preparedFor: 'PREPARADO PARA', billTo: 'FACTURAR A', desc: 'Descripción', qty: 'Cant.', price: 'Precio', amount: 'Importe',
  subtotal: 'Subtotal', tax: 'Impuesto', total: 'Total', totalDue: 'Total a pagar', notes: 'Notas', payment: 'Formas de pago', terms: 'Condiciones',
  accept: 'Aceptación del cliente', signature: 'Firma', sigDate: 'Fecha', thanks: '¡Gracias por su preferencia!', paid: 'PAGADA',
  file: { estimate: 'Estimado', invoice: 'Factura' },
  acceptBtn: 'Aceptar estimado', declineBtn: 'Rechazar', yourName: 'Su nombre completo', acceptLegal: 'Al aceptar, aprueba el trabajo y los precios descritos arriba.',
  acceptedOn: 'Aceptado por {name} el {date}', declinedOn: 'Rechazado el {date}', declineReason: 'Motivo (opcional)',
  confirmDecline: 'Confirmar rechazo', thanksAccept: '¡Gracias! Le contactaremos pronto para agendar el trabajo.',
  payCard: 'Pagar {total} con tarjeta', paidOn: 'Pagada el {date}', thanksPaid: 'Pago recibido. ¡Gracias!', downloadPdf: 'Descargar PDF',
  questions: '¿Preguntas? Llame o escriba al', switchLang: 'View in English', expired: 'Este estimado venció el {date}. Contáctenos para un precio actualizado.',
  notFound: 'Este documento no está disponible.', voided: 'Este documento fue anulado.', processing: 'Procesando…',
  smsEst: d => `Hola ${d.first}, le saluda ${d.owner} de ${d.co}. Su estimado ${d.num} por ${d.total} está listo. Puede verlo y aceptarlo aquí: ${d.link}`,
  smsInv: d => `Hola ${d.first}, ¡gracias por elegir ${d.co}! Su factura ${d.num} por ${d.total} está lista. Véala o páguela aquí: ${d.link}`,
  subjEst: d => `Estimado ${d.num} de ${d.co}`, subjInv: d => `Factura ${d.num} de ${d.co}`,
  mailEst: d => `Hola ${d.first}:\n\nGracias por la oportunidad. Este es su estimado ${d.num}:\n\n${d.lines}\n\nTotal: ${d.total}\nVálido hasta: ${d.valid}\n\nPuede revisarlo y aceptarlo en línea:\n${d.link}\n\nAdjuntamos el PDF. Responda a este correo o llame al ${d.phone} si tiene preguntas.\n\nSaludos cordiales,\n${d.owner}\n${d.co}`,
  mailInv: d => `Hola ${d.first}:\n\nGracias por elegir ${d.co}. Esta es su factura ${d.num}:\n\n${d.lines}\n\nTotal a pagar: ${d.total}\n\nVéala o páguela en línea:\n${d.link}\n\n${d.payment}\n\nAdjuntamos el PDF. ¿Preguntas? Responda a este correo o llame al ${d.phone}.\n\nSaludos cordiales,\n${d.owner}\n${d.co}`,
  viewOnline: 'Ver en línea',
  notifyAccepted: (num, name) => `El estimado ${num} fue aceptado por ${name}`,
  notifyDeclined: num => `El estimado ${num} fue rechazado`,
  notifyPaid: (num, total) => `La factura ${num} fue pagada con tarjeta (${total})`,
};

export const DOC: Record<Lang, DocDict> = { en, es };
export const docDict = (l: string | null | undefined) => (l === 'es' ? es : en);
