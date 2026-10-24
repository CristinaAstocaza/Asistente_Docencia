import JSZip from 'jszip';
import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * Extrae el escudo o logotipo institucional de la primera página del documento de referencia
 * (soporta PDF, DOCX o imágenes directas) para estamparlo fielmente en la portada generada.
 */
export async function extractCoverLogo(bytes: Buffer, type: string): Promise<Buffer | null> {
 try {
  const ext = (type || '').toUpperCase();
  if (ext === 'PDF') {
   const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
   const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true } as any).promise;
   const page = await doc.getPage(1);
   const ops = await page.getOperatorList();
   const images: any[] = [];
   for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjs.OPS.paintImageXObject || ops.fnArray[i] === pdfjs.OPS.paintInlineImageXObject) {
     const imgName = ops.argsArray[i][0];
     await new Promise<void>(resolve => {
      page.objs.get(imgName, (img: any) => {
       if (img && img.data && img.width >= 32 && img.height >= 32) {
        images.push(img);
       }
       resolve();
      });
     });
    }
   }
   if (!images.length) return null;
   // Ordenar por área para seleccionar el escudo más destacado
   images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
   const best = images[0];

   const canvas = createCanvas(best.width, best.height);
   const ctx = canvas.getContext('2d');
   const imgData = ctx.createImageData(best.width, best.height);
   if (best.data.length === best.width * best.height * 4) {
    imgData.data.set(best.data);
   } else if (best.data.length === best.width * best.height * 3) {
    let src = 0, dst = 0;
    while (src < best.data.length) {
     imgData.data[dst++] = best.data[src++];
     imgData.data[dst++] = best.data[src++];
     imgData.data[dst++] = best.data[src++];
     imgData.data[dst++] = 255;
    }
   } else if (best.data.length === best.width * best.height) {
    let src = 0, dst = 0;
    while (src < best.data.length) {
     const v = best.data[src++];
     imgData.data[dst++] = v;
     imgData.data[dst++] = v;
     imgData.data[dst++] = v;
     imgData.data[dst++] = 255;
    }
   }
   ctx.putImageData(imgData, 0, 0);
   return canvas.toBuffer('image/png');
  }

  if (ext === 'DOCX') {
   const zip = await JSZip.loadAsync(bytes);
   const mediaFiles = Object.keys(zip.files).filter(f => /^word\/media\/.+\.(png|jpe?g|gif|webp)$/i.test(f));
   if (!mediaFiles.length) return null;
   const mediaBuf = await zip.files[mediaFiles[0]].async('nodebuffer');
   const image = await loadImage(mediaBuf);
   const canvas = createCanvas(image.width, image.height);
   canvas.getContext('2d').drawImage(image, 0, 0);
   return canvas.toBuffer('image/png');
  }

  if (['PNG', 'JPG', 'JPEG'].includes(ext)) {
   const image = await loadImage(bytes);
   const canvas = createCanvas(image.width, image.height);
   canvas.getContext('2d').drawImage(image, 0, 0);
   return canvas.toBuffer('image/png');
  }
 } catch (err) {
  return null;
 }
 return null;
}
