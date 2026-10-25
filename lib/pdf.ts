import 'server-only';
import { jsPDF } from 'jspdf';
import { docDict } from './i18n/doc';
import { fmtDate, fmtPhone, itemName, money, num } from './format';
import type { Business, FullDoc } from './types';

type RGB = [number, number, number];
const hex = (h: string, fb: RGB): RGB => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : fb;
};

/** Descarga el logo del negocio y lo devuelve listo para jsPDF (con su proporción). */
async function loadLogo(url: string | null) {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    let fmt: 'PNG' | 'JPEG' | null = null, w = 0, h = 0;
    if (buf[0] === 0x89 && buf[1] === 0x50) { fmt = 'PNG'; w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    else if (buf[0] === 0xff && buf[1] === 0xd8) {
      fmt = 'JPEG';
      for (let i = 2; i < buf.length - 9;) {             // busca el marcador SOF para el tamaño
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
        i += 2 + len;
      }
    }
    if (!fmt || !w || !h) return null;
    return { data: `data:image/${fmt.toLowerCase()};base64,${buf.toString('base64')}`, fmt, ratio: h / w };
  } catch { return null; }
}

export async function renderPdf(doc: FullDoc, biz: Business): Promise<Buffer> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const L = docDict(doc.lang), c = doc.customer, isEst = doc.type === 'estimate';
  const W = 612, M = 44, R = W - M;
  const NAVY = hex(biz.brand_color, [27, 53, 102]), TEAL = hex(biz.accent_color, [31, 154, 154]);
  const MUTED: RGB = [93, 107, 130], LINE: RGB = [217, 226, 238], INK: RGB = [20, 33, 58];
  const terms = ((doc.lang === 'es' ? biz.terms_est_es : biz.terms_est_en) || '').replace('{days}', String(biz.valid_days));
  const payment = (doc.lang === 'es' ? biz.payment_text_es : biz.payment_text_en) || '';
  let y = 40;

  // encabezado: logo (o nombre) + título y datos
  const logo = await loadLogo(biz.logo_url);
  if (logo) {
    let lw = 158, lh = lw * logo.ratio;
    if (lh > 96) { lh = 96; lw = lh / logo.ratio; }
    pdf.addImage(logo.data, logo.fmt, M, y, lw, lh);
  } else {
    pdf.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...NAVY);
    pdf.text(pdf.splitTextToSize(biz.name, 250), M, y + 22);
  }
  pdf.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...NAVY);
  pdf.text(isEst ? L.estimate : L.invoice, R, y + 26, { align: 'right' });
  pdf.setFontSize(10);
  const meta: [string, string][] = [[L.no, doc.number], [L.date, fmtDate(doc.issue_date, doc.lang)],
    isEst ? [L.validUntil, fmtDate(doc.valid_until, doc.lang)] : [L.due, L.dueOnReceipt]];
  meta.forEach(([k, v], i) => {
    pdf.setTextColor(...MUTED).setFont('helvetica', 'normal').text(k + ':', R - 125, y + 48 + i * 15, { align: 'right' });
    pdf.setTextColor(...INK).setFont('helvetica', 'bold').text(v, R, y + 48 + i * 15, { align: 'right' });
  });
  if (!isEst && doc.status === 'paid') {
    pdf.setDrawColor(31, 138, 76).setLineWidth(2.5).setTextColor(31, 138, 76).setFont('helvetica', 'bold').setFontSize(20);
    pdf.roundedRect(R - 110, y + 98, 110, 32, 4, 4);
    pdf.text(L.paid, R - 55, y + 120, { align: 'center' });
  }
  y += 108;
  pdf.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED);
  const coLines = [biz.name, biz.address1, biz.address2, [biz.phone, biz.email].filter(Boolean).join('  ·  '), biz.website].filter(Boolean);
  coLines.forEach((l, i) => pdf.text(l, M, y + i * 13));
  y += coLines.length * 13 + 14;

  // cliente
  const billLines = [c.address, fmtPhone(c.phone), c.email].filter(Boolean);
  const bh = 34 + billLines.length * 13;
  pdf.setFillColor(244, 247, 251).roundedRect(M, y, R - M, bh, 6, 6, 'F');
  pdf.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...TEAL).text(isEst ? L.preparedFor : L.billTo, M + 12, y + 15);
  pdf.setFontSize(12).setTextColor(...INK).text(c.name || '', M + 12, y + 30);
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  billLines.forEach((l, i) => pdf.text(l, M + 12, y + 44 + i * 13));
  y += bh + 18;

  // tabla de partidas
  const cx = { d: M + 10, q: R - 190, p: R - 100, a: R - 10 };
  const header = () => {
    pdf.setFillColor(...NAVY).rect(M, y, R - M, 22, 'F');
    pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255);
    pdf.text(L.desc, cx.d, y + 15);
    pdf.text(L.qty, cx.q, y + 15, { align: 'right' });
    pdf.text(L.price, cx.p, y + 15, { align: 'right' });
    pdf.text(L.amount, cx.a, y + 15, { align: 'right' });
    y += 22;
  };
  const ensure = (h: number) => { if (y + h > 740) { pdf.addPage(); y = 50; return true; } return false; };
  header();
  doc.items.forEach((it, idx) => {
    pdf.setFont('helvetica', 'normal').setFontSize(10.5);
    const desc: string[] = pdf.splitTextToSize(itemName(it, doc.lang), cx.q - cx.d - 40);
    const rh = 14 + desc.length * 13;
    if (ensure(rh)) header();
    if (idx % 2) pdf.setFillColor(248, 250, 253).rect(M, y, R - M, rh, 'F');
    pdf.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...INK);
    pdf.text(desc, cx.d, y + 16);
    pdf.text(String(num(it.qty)), cx.q, y + 16, { align: 'right' });
    pdf.text(money(it.price), cx.p, y + 16, { align: 'right' });
    pdf.setFont('helvetica', 'bold').text(money(num(it.qty) * num(it.price)), cx.a, y + 16, { align: 'right' });
    y += rh;
    pdf.setDrawColor(...LINE).setLineWidth(0.6).line(M, y, R, y);
  });

  // totales
  ensure(90);
  y += 16;
  const tx = R - 220;
  const trow = (k: string, v: string) => {
    pdf.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...MUTED).text(k, tx + 10, y);
    pdf.setTextColor(...INK).text(v, cx.a, y, { align: 'right' });
    y += 17;
  };
  trow(L.subtotal, money(doc.subtotal));
  if (Number(doc.tax)) trow(`${L.tax} (${Number(doc.tax_rate)}%)`, money(doc.tax));
  pdf.setFillColor(...TEAL).roundedRect(tx, y - 4, R - tx, 28, 4, 4, 'F');
  pdf.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(255, 255, 255);
  pdf.text(isEst ? L.total : L.totalDue, tx + 10, y + 14);
  pdf.text(money(doc.total), cx.a, y + 14, { align: 'right' });
  y += 46;

  const block = (title: string, text: string) => {
    if (!text) return;
    pdf.setFont('helvetica', 'normal').setFontSize(9.5);
    const lines: string[] = pdf.splitTextToSize(text, R - M);
    ensure(20 + lines.length * 12);
    pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text(title, M, y);
    pdf.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(60, 72, 92).text(lines, M, y + 14);
    y += 22 + lines.length * 12;
  };
  block(L.notes, doc.notes);
  if (!isEst) block(L.payment, payment);
  if (isEst) block(L.terms, terms);

  if (isEst) {
    ensure(64);
    y += 16;
    pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text(L.accept, M, y);
    if (doc.accepted_at && doc.accepted_name) {
      pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(31, 138, 76);
      pdf.text(L.acceptedOn.replace('{name}', doc.accepted_name).replace('{date}', fmtDate(doc.accepted_at, doc.lang)), M, y + 18);
      y += 26;
    } else {
      y += 30;
      pdf.setDrawColor(150, 160, 175).setLineWidth(0.8);
      pdf.line(M, y, M + 260, y);
      pdf.line(R - 160, y, R, y);
      pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
      pdf.text(L.signature, M, y + 12);
      pdf.text(L.sigDate, R - 160, y + 12);
    }
  }

  // pie en todas las páginas
  const pages = pdf.getNumberOfPages();
  const foot = [biz.tagline, biz.website.replace(/^https?:\/\//, '').replace(/^www\./, ''), biz.phone].filter(Boolean).join('  ·  ');
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...TEAL).setLineWidth(2).line(M, 752, R, 752);
    pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TEAL).text(L.thanks, W / 2, 768, { align: 'center' });
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(foot, W / 2, 781, { align: 'center' });
    if (pages > 1) pdf.text(`${p}/${pages}`, R, 781, { align: 'right' });
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
