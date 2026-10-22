// UniFi printable vouchers: exactly five digits, a hyphen, then five digits.
// This export's embedded font maps zero and hyphen to private-use Unicode glyphs.
export function extractVoucherCodes(text) {
  const normalized = text.replaceAll('\ue06b', '0').replaceAll('\ue088', '-').replace(/[‐‑–−]/g, '-');
  const matches = [...normalized.matchAll(/(?<![\d\p{L}])\d{5}\s*-\s*\d{5}(?![\d\p{L}])/gu)].map(match => match[0].replace(/\s/g, ''));
  return { codes: [...new Set(matches)], duplicates: matches.length - new Set(matches).size };
}

export const voucherTextFromItems = items => items.map(item => (item.str || '') + (item.hasEOL ? '\n' : '')).join('');

export async function readVoucherPdf(file) {
  if (!/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF voucher sheet.');
  if (file.size > 10 * 1024 * 1024) throw new Error('PDF must be 10 MB or smaller.');
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error('Import up to 30 PDF pages at a time.');
    const texts = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), content = await page.getTextContent();
      texts.push(voucherTextFromItems(content.items));
      page.cleanup();
    }
    const result = extractVoucherCodes(texts.join('\n'));
    if (!result.codes.length) throw new Error('No readable 12345-67890 voucher codes found. Scanned PDFs need a text-based export.');
    if (result.codes.length > 500) throw new Error('Import up to 500 unique voucher codes at a time.');
    return { ...result, pages: pdf.numPages };
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('Use an unlocked PDF voucher sheet.');
    throw error;
  } finally { await task.destroy(); }
}
