/**
 * Detects if a string contains raw binary PDF markers or file structures.
 * Safeguards against displaying raw PDF binary data in the UI.
 */
export function isRawPdfBinary(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.startsWith('%PDF-') || trimmed.startsWith('%PDF')) return true;
  if (/^[\s\S]{0,1024}%PDF-/i.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('/type /catalog') ||
    lower.includes('/type/catalog') ||
    lower.includes('/mediabox') ||
    lower.includes('/procset') ||
    lower.includes('/flatedecode') ||
    lower.includes('/pages 2 0 r') ||
    (lower.includes('obj') && lower.includes('endobj')) ||
    (lower.includes('<<') && lower.includes('/type') && lower.includes('>>'))
  ) {
    return true;
  }
  return false;
}

/**
 * Inspects the magic bytes of a file to reliably identify PDF files,
 * even when the file has no extension or an inaccurate MIME type.
 */
export async function isPdfFileByMagic(file: File): Promise<boolean> {
  try {
    const slice = await file.slice(0, 1024).arrayBuffer();
    const bytes = new Uint8Array(slice);
    for (let i = 0; i <= bytes.length - 4; i++) {
      // '%PDF' = 0x25, 0x50, 0x44, 0x46
      if (
        bytes[i] === 0x25 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x44 &&
        bytes[i + 3] === 0x46
      ) {
        return true;
      }
    }
  } catch {
    // If slice fails, fall back to mime / extension
  }
  return false;
}

/**
 * Extracts plain text directly in the client browser using standalone pdfjs-dist legacy engine.
 * Fast, reliable, handles Canva presentation slides, and bypasses Vercel payload limits.
 */
async function extractPdfTextInBrowser(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Configure worker source for browser environments (local bundle with CDN fallback)
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.4.296'}/legacy/build/pdf.worker.min.mjs`;
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .map((item: any) => item?.str || '')
      .filter((s: string) => s.trim().length > 0);
    if (strings.length > 0) {
      fullText += `\n--- Halaman / Slide ${i} ---\n` + strings.join(' ') + '\n';
    }
  }
  return fullText.trim();
}

/**
 * Extracts plain text from an uploaded document (pdf, docx, txt, md, etc.).
 * Guarantees that PDF files are handled as binary application/pdf and never read as raw string.
 */
export async function parseDocumentFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Detect MIME type & file category, including Magic Bytes inspection
  const isPdfByMagic = await isPdfFileByMagic(file);
  const isPdf = isPdfByMagic || file.type === 'application/pdf' || extension === 'pdf';
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx' ||
    extension === 'doc';
  const isPlainText =
    !isPdf &&
    (['txt', 'md', 'csv', 'json'].includes(extension) ||
      (file.type && file.type.startsWith('text/')));

  // 2. Specialized PDF Pipeline
  // Strictly maintain binary handling and NEVER use file.text() or FileReader.readAsText() on PDF files
  if (isPdf) {
    // A. First attempt: High-speed, local browser extraction via pdfjs-dist legacy
    try {
      const clientText = await extractPdfTextInBrowser(file);
      if (clientText && clientText.length > 20 && !isRawPdfBinary(clientText)) {
        return clientText;
      }
    } catch (clientPdfErr) {
      console.warn('Client-side PDF extraction fallback to server:', clientPdfErr);
    }

    // Check file size before serverless upload to prevent Vercel 413 Payload Too Large
    const maxServerSizeBytes = 4.2 * 1024 * 1024;
    if (file.size > maxServerSizeBytes) {
      const mbSize = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Berkas PDF (${mbSize} MB) melebihi batas upload serverless Vercel (maksimum 4.5 MB) dan tidak memiliki teks digital langsung di peramban. Saran: Kompres PDF Anda ke bawah 4 MB, gunakan berkas DOCX, atau salin-tempel teks materi langsung ke kolom materi.`
      );
    }

    // B. Second attempt: Server extraction (handles scanned / multimodal / complex PDFs)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca berkas PDF sebagai biner.'));
      reader.readAsDataURL(file);
    });

    let response: Response;
    try {
      response = await fetch('/api/parse-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileType: 'application/pdf',
          fileName: file.name,
        }),
      });
    } catch (networkErr: any) {
      throw new Error(
        'Gagal menghubungi server ekstraksi dokumen. Periksa koneksi internet atau coba kembali.'
      );
    }

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(
          'Ukuran berkas PDF terlalu besar untuk server Vercel (Payload Too Large, maks 4.5 MB). Silakan kompres PDF atau salin teks materi langsung.'
        );
      }
      if (response.status === 504) {
        throw new Error(
          'Waktu pemrosesan di server Vercel habis (Gateway Timeout). Dokumen mungkin terlalu tebal atau berhalaman banyak. Saran: unggah dokumen dengan halaman lebih sedikit atau salin bagian teks yang ingin dijadikan soal.'
        );
      }
      const errJson = await response.json().catch(() => null);
      throw new Error(
        errJson?.error ||
        'Gagal memproses dokumen PDF di server. Pastikan variabel GEMINI_API_KEY sudah terpasang di Environment Variables Vercel.'
      );
    }

    const data = await response.json();
    const extractedText = data?.text || '';

    // Strict validation: never allow raw PDF stream markers
    if (isRawPdfBinary(extractedText)) {
      throw new Error('Ekstraksi PDF menghasilkan data biner mentah. Dokumen tidak dapat diproses.');
    }

    if (extractedText.trim().length > 10) {
      return extractedText.trim();
    }

    throw new Error('Dokumen PDF kosong atau teks materi di dalamnya tidak dapat diekstrak.');
  }

  // 3. DOCX Pipeline
  if (isDocx) {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca berkas dokumen.'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/parse-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileName: file.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text && !isRawPdfBinary(data.text) && data.text.trim().length > 10) {
          return data.text.trim();
        }
      }
    } catch (serverErr) {
      console.warn('Server DOCX parse fallback to client mammoth:', serverErr);
    }

    // Client-side fallback using mammoth for DOCX
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 10) {
        return result.value.trim();
      }
    } catch (mammothErr) {
      console.warn('Client mammoth extraction failed:', mammothErr);
    }
  }

  // 4. Plain Text Pipeline (TXT, MD, CSV, JSON)
  if (isPlainText) {
    try {
      const text = await file.text();
      if (isRawPdfBinary(text)) {
        throw new Error('Berkas terdeteksi sebagai dokumen PDF biner.');
      }
      return text;
    } catch (err: any) {
      if (err.message && err.message.includes('PDF')) throw err;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string) || '';
          if (isRawPdfBinary(text)) {
            reject(new Error('Berkas terdeteksi sebagai biner PDF yang tidak valid.'));
          } else {
            resolve(text);
          }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas teks.'));
        reader.readAsText(file);
      });
    }
  }

  // 5. Generic Non-PDF fallback
  // STRICT GUARD: Re-verify that file is not a PDF under any circumstances
  if (await isPdfFileByMagic(file)) {
    throw new Error('Berkas PDF tidak dapat dibaca sebagai teks biasa. Gunakan format berkas PDF standar.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        // If file turns out to be PDF binary despite extension, reject immediately!
        if (isRawPdfBinary(text)) {
          reject(new Error('Berkas terdeteksi sebagai biner PDF yang tidak valid untuk dibaca sebagai teks biasa.'));
          return;
        }

        const printableText = text
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (printableText.length > 50) {
          resolve(printableText.slice(0, 10000));
        } else {
          resolve(`Berkas "${file.name}" terlampir. Silakan tambahkan rincian materi jika diperlukan.`);
        }
      } catch (err) {
        reject(new Error('Gagal membaca konten berkas.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsText(file);
  });
}
