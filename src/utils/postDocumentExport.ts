import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { Team } from '../services/api';
import type { SummaryStats } from './summaryStats';
import watermarkUrl from '../assets/images/ss.png';
const logoUrl = watermarkUrl; // Use same image as watermark for logo

type ImageType = 'front' | 'group' | 'before' | 'after';

interface TeamImageRecord {
  imageType: ImageType;
  category?: string;
  imageUrl: string;
  remarks?: string;
}

interface CategoryOption {
  id: string;
  label: string;
}

interface PreparedImage extends TeamImageRecord {
  dataUrl: string;
  mimeType: string;
  extension: 'png' | 'jpeg';
}

interface MediaFile {
  id: number;
  data: string;
  extension: 'png' | 'jpeg';
}

const categories: CategoryOption[] = [
  { id: 'spare_location', label: 'Spare Location' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'gowdown', label: 'Gowdown' },
  { id: 'oil', label: 'Oil' },
  { id: 'battery', label: 'Battery' },
  { id: 'tyres', label: 'Tyres' }
];

const fileBaseName = (team: Team) =>
  `Post_Document_${(team.siteName || 'Team').replace(/[^a-z0-9]+/gi, '_')}`;

const sanitizeXmlText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const escapeXml = (value: string) =>
  sanitizeXmlText(String(value ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image data.'));
    reader.readAsDataURL(blob);
  });

const blobToPngDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          cleanup();
          reject(new Error('Loaded image has no dimensions.'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          cleanup();
          reject(new Error('Unable to create image canvas.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const pngDataUrl = canvas.toDataURL('image/png');
        cleanup();
        resolve(pngDataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    image.onerror = () => {
      cleanup();
      reject(new Error('Unable to decode image.'));
    };

    image.src = objectUrl;
  });

const loadDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Unable to load image: ${url}`);
  const blob = await response.blob();

  try {
    return await blobToPngDataUrl(blob);
  } catch (error) {
    if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
      return blobToDataUrl(blob);
    }
    throw error;
  }
};

const dataUrlMeta = (dataUrl: string): { mimeType: string; extension: 'png' | 'jpeg' } => {
  const mimeType = dataUrl.match(/^data:(.*?);base64,/)?.[1] || 'image/png';
  return {
    mimeType,
    extension: mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpeg' : 'png'
  };
};

const formatDate = (dateValue?: string | Date) => {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getTeamImages = (team: Team): TeamImageRecord[] =>
  Array.isArray(team.images) ? team.images as TeamImageRecord[] : [];

const prepareImages = async (team: Team): Promise<PreparedImage[]> => {
  const images = getTeamImages(team);
  const results = await Promise.allSettled(images.map(async (image): Promise<PreparedImage> => {
    const dataUrl = await loadDataUrl(image.imageUrl);
    return { ...image, dataUrl, mimeType: 'image/png', extension: 'png' };
  }));
  return results
    .filter((result): result is PromiseFulfilledResult<PreparedImage> => result.status === 'fulfilled')
    .map((result) => result.value);
};

const splitDataUrl = (dataUrl: string) => dataUrl.split(',')[1] || '';

const addPdfWatermark = (doc: jsPDF, watermarkDataUrl: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  const gState = new (doc as any).GState({ opacity: 0.08 });
  doc.setGState(gState);
  doc.addImage(watermarkDataUrl, 'PNG', pageWidth * 0.25, pageHeight * 0.25, pageWidth * 0.5, pageWidth * 0.5);
  doc.restoreGraphicsState();
};

const addPdfHeader = (doc: jsPDF, watermarkDataUrl: string, logoDataUrl: string, title?: string) => {
  addPdfWatermark(doc, watermarkDataUrl);
  doc.addImage(logoDataUrl, 'PNG', 14, 10, 28, 16);
  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 48, 20);
  }
};

const addBoldLabel = (doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth = 180) => {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);
  const labelWidth = doc.getTextWidth(label) + 1.5;
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(value || 'N/A', maxWidth - labelWidth), x + labelWidth, y);
};

const addPdfCoverPage = (doc: jsPDF, watermarkDataUrl: string, logoDataUrl: string, team: Team) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.addImage(logoDataUrl, 'PNG', pageWidth - 74, 22, 48, 26);

  doc.saveGraphicsState();
  const gState = new (doc as any).GState({ opacity: 0.13 });
  doc.setGState(gState);
  doc.addImage(watermarkDataUrl, 'PNG', pageWidth * 0.2, pageHeight * 0.42, pageWidth * 0.62, pageWidth * 0.42);
  doc.restoreGraphicsState();

  doc.setTextColor(0, 60, 84);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Post Document of Stock Audit', pageWidth / 2, pageHeight * 0.54, { align: 'center' });
  doc.setFontSize(20);
  doc.text(team.siteName || 'Current Team', pageWidth / 2, pageHeight * 0.61, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

export const downloadTeamPostDocumentPdf = async (team: Team, summaryStats: SummaryStats | null = null) => {
  const [watermarkDataUrl, logoDataUrl, preparedImages] = await Promise.all([
    loadDataUrl(watermarkUrl),
    loadDataUrl(logoUrl),
    prepareImages(team)
  ]);

  const doc = new jsPDF('p', 'mm', 'a4');
  const frontImage = preparedImages.find((image) => image.imageType === 'front');
  const groupImage = preparedImages.find((image) => image.imageType === 'group');

  addPdfCoverPage(doc, watermarkDataUrl, logoDataUrl, team);

  doc.addPage();
  addPdfHeader(doc, watermarkDataUrl, logoDataUrl, 'Audit Summary');
  doc.setFontSize(11);
  const endDateDisplay = team.status === 'Completed' ? formatDate(team.auditEndDate || team.updatedAt) : 'Not completed yet';
  addBoldLabel(doc, 'Audit Start Date:', formatDate(team.auditStartDate || team.createdAt), 24, 42, 160);
  addBoldLabel(doc, 'Audit End Date:', endDateDisplay, 24, 52, 160);

  let contentY = 70;

  if (summaryStats) {
    const formatNum = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const rowData = [
      ['Count of Part No. before audit', summaryStats.countPartNoBefore.toLocaleString('en-IN'), 'Count of Part No. after audit', summaryStats.countPartNoAfter.toLocaleString('en-IN')],
      ['Count of Shortage Parts', summaryStats.countShortage.toLocaleString('en-IN'), 'Value of Shortage Parts', `Rs. ${formatNum(summaryStats.valueShortage)}`],
      ['Count of Excess Parts', summaryStats.countExcess.toLocaleString('en-IN'), 'Value of Excess Parts', `Rs. ${formatNum(summaryStats.valueExcess)}`],
      ['Total NDP Value before audit', `Rs. ${formatNum(summaryStats.totalNdpBefore)}`, 'Total NDP Value after audit', `Rs. ${formatNum(summaryStats.totalNdpAfter)}`],
      ['No of Line item counted', summaryStats.noLineItemsDup.toLocaleString('en-IN'), 'Count of Extras found during audit', summaryStats.extrasUnique.toLocaleString('en-IN')],
      ['No of Line item counted - Unique', summaryStats.noLineItemsUnique.toLocaleString('en-IN'), 'Total MRP Value after audit', `Rs. ${formatNum(summaryStats.totalMrpAfter)}`]
    ];

    autoTable(doc, {
      startY: contentY,
      head: [[
        { 
          content: team.siteName || 'Site Name', 
          colSpan: 4, 
          styles: { halign: 'center', fillColor: [255, 255, 255], textColor: [0, 79, 152], fontSize: 16, fontStyle: 'bold', lineColor: [0, 176, 80], lineWidth: 0.5 } 
        }
      ]],
      body: rowData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 4,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', fillColor: [255, 255, 255], cellWidth: 55 },
        1: { fontStyle: 'bold', halign: 'right', fillColor: [230, 242, 255], cellWidth: 35 },
        2: { fontStyle: 'bold', halign: 'left', fillColor: [255, 255, 255], cellWidth: 55 },
        3: { fontStyle: 'bold', halign: 'right', fillColor: [230, 242, 255], cellWidth: 35 },
      },
      margin: { left: 15, right: 15 },
    });

    contentY = (doc as any).lastAutoTable.finalY + 10;

    
    // Start site images on a new page since table takes space
    doc.addPage();
    addPdfHeader(doc, watermarkDataUrl, logoDataUrl, 'Site Images');
    contentY = 38;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Site Images', 14, contentY);
    contentY += 8;
  }

  const imageY = contentY;
  const imageWidth = 84;
  const imageHeight = 58;
  const imageSlots = [
    { label: 'Front image', remarkLabel: 'Front Remark:', image: frontImage, x: 14 },
    { label: 'Group image', remarkLabel: 'Group Remark:', image: groupImage, x: 110 }
  ];

  imageSlots.forEach((slot) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(slot.label, slot.x, imageY - 3);
    if (slot.image) {
      doc.addImage(slot.image.dataUrl, slot.image.extension.toUpperCase(), slot.x, imageY, imageWidth, imageHeight);
    } else {
      doc.rect(slot.x, imageY, imageWidth, imageHeight);
      doc.setFont('helvetica', 'normal');
      doc.text('No image uploaded', slot.x + imageWidth / 2, imageY + imageHeight / 2, { align: 'center' });
    }
    addBoldLabel(doc, slot.remarkLabel, slot.image?.remarks || 'N/A', slot.x, imageY + imageHeight + 8, imageWidth);
  });

  doc.addPage();
  addPdfHeader(doc, watermarkDataUrl, logoDataUrl, 'Before and After Images');
  let y = 38;

  categories.forEach((category) => {
    const beforeImages = preparedImages.filter((image) => image.imageType === 'before' && image.category === category.id);
    const afterImages = preparedImages.filter((image) => image.imageType === 'after' && image.category === category.id);
    if (!beforeImages.length && !afterImages.length) return;

    if (y > 220) {
      doc.addPage();
      addPdfHeader(doc, watermarkDataUrl, logoDataUrl, 'Before and After Images');
      y = 38;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(category.label, 14, y);
    y += 9;

    const maxRows = Math.max(beforeImages.length, afterImages.length);
    for (let index = 0; index < maxRows; index += 1) {
      if (y > 220) {
        doc.addPage();
        addPdfHeader(doc, watermarkDataUrl, logoDataUrl, 'Before and After Images');
        y = 38;
      }

      const before = beforeImages[index];
      const after = afterImages[index];
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Before Image ${index + 1}`, 14, y);
      doc.text(`After Image ${index + 1}`, 110, y);
      y += 4;

      if (before) doc.addImage(before.dataUrl, before.extension.toUpperCase(), 14, y, 84, 56);
      else doc.rect(14, y, 84, 56);
      if (after) doc.addImage(after.dataUrl, after.extension.toUpperCase(), 110, y, 84, 56);
      else doc.rect(110, y, 84, 56);
      y += 64;
    }

    addBoldLabel(doc, 'Before Remark:', beforeImages[0]?.remarks || 'N/A', 14, y, 180);
    y += 8;
    addBoldLabel(doc, 'After Remark:', afterImages[0]?.remarks || 'N/A', 14, y, 180);
    y += 14;
  });

  doc.save(`${fileBaseName(team)}.pdf`);
};

const emu = (inches: number) => Math.round(inches * 914400);

const textShape = (id: number, text: string, x: number, y: number, w: number, h: number, fontSize = 1800, bold = false, align = 'l') => `
<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
  <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:pPr ${align === 'r' ? 'algn="r"' : align === 'ctr' ? 'algn="ctr"' : ''}/><a:r><a:rPr lang="en-US" sz="${fontSize}"${bold ? ' b="1"' : ''}/><a:t>${escapeXml(text)}</a:t></a:r></a:p></p:txBody>
</p:sp>`;

const cellShape = (id: number, text: string, x: number, y: number, w: number, h: number, fontSize = 1100, bold = false, align = 'l', fillColor = 'FFFFFF', borderColor = 'DCDCDC', textColor = '000000') => `
<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="Cell ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    ${fillColor === 'none' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${fillColor}"/></a:solidFill>`}
    <a:ln w="9525">${borderColor === 'none' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill>`}</a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr ${align === 'r' ? 'algn="r"' : align === 'ctr' ? 'algn="ctr"' : ''}/>
      <a:r><a:rPr lang="en-US" sz="${fontSize}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${textColor}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;

const imageShape = (id: number, relationshipId: string, x: number, y: number, w: number, h: number, opacity?: number) => `
<p:pic>
  <p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
  <p:blipFill><a:blip r:embed="${relationshipId}">${opacity ? `<a:alphaModFix amt="${opacity}"/>` : ''}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill>
  <p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;

const slideXml = (shapes: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes}
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

const relsXml = (relationships: string[]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`;

const relationship = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

const packageRelationship = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/package/2006/relationships/${type}" Target="${target}"/>`;

const addSlide = (
  zip: JSZip,
  slideIndex: number,
  shapes: string,
  mediaRelationships: string[]
) => {
  zip.file(`ppt/slides/slide${slideIndex}.xml`, slideXml(shapes));
  zip.file(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, relsXml([
    relationship('rIdLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml'),
    ...mediaRelationships
  ]));
};

const downloadTeamPostDocumentPptxLegacy = async (team: Team, summaryStats: SummaryStats | null = null) => {
  const [watermarkDataUrl, logoDataUrl, preparedImages] = await Promise.all([
    loadDataUrl(watermarkUrl),
    loadDataUrl(logoUrl),
    prepareImages(team)
  ]);

  const zip = new JSZip();
  const mediaFiles: MediaFile[] = [];
  const addMedia = (dataUrl: string, extension: 'png' | 'jpeg') => {
    const id = mediaFiles.length + 1;
    mediaFiles.push({ id, data: splitDataUrl(dataUrl), extension });
    return { target: `../media/image${id}.${extension}`, relationshipId: `rId${id}` };
  };

  const watermarkMedia = addMedia(watermarkDataUrl, 'png');
  const logoMedia = addMedia(logoDataUrl, 'png');
  const slideEntries: { shapes: string; relationships: string[] }[] = [];

  const baseSlideShapes = (title?: string) => [
    imageShape(2, watermarkMedia.relationshipId, 2.6, 1.1, 4.8, 4.0, 12000),
    imageShape(3, logoMedia.relationshipId, 0.35, 0.25, 1.15, 0.55),
    title ? textShape(4, title, 1.65, 0.32, 7.8, 0.35, 1500, true) : ''
  ].join('');
  const slideWidthInches = 10.0;
  const coverSlideShapes = [
    imageShape(2, watermarkMedia.relationshipId, 2.15, 2.55, 5.4, 2.35, 13000),
    imageShape(3, logoMedia.relationshipId, 6.75, 0.5, 1.95, 0.8),
    cellShape(11, 'Post Document of Stock Audit', 0, 3.08, 10.0, 0.5, 2300, true, 'ctr', 'none', 'none', '003C54'),
    cellShape(12, team.siteName || 'Current Team', 0, 3.7, 10.0, 0.4, 1800, true, 'ctr', 'none', 'none', '003C54')
  ].join('');
  const baseRelationships = [
    relationship(watermarkMedia.relationshipId, 'image', watermarkMedia.target),
    relationship(logoMedia.relationshipId, 'image', logoMedia.target)
  ];

  slideEntries.push({
    shapes: coverSlideShapes,
    relationships: [...baseRelationships]
  });

  const endDateDisplay = team.status === 'Completed' ? formatDate(team.auditEndDate || team.updatedAt) : 'Not completed yet';
  const summarySlideShapes = [
    baseSlideShapes('Audit Summary'),
    textShape(20, `Audit Start Date: ${formatDate(team.auditStartDate || team.createdAt)}`, 0.8, 0.9, 7.8, 0.3, 1200, true),
    textShape(21, `Audit End Date: ${endDateDisplay}`, 0.8, 1.25, 7.8, 0.3, 1200, true)
  ];

  if (summaryStats) {
    const formatNum = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rowData = [
      ['Count of Part No. before audit', summaryStats.countPartNoBefore.toLocaleString('en-IN'), 'Count of Part No. after audit', summaryStats.countPartNoAfter.toLocaleString('en-IN')],
      ['Count of Shortage Parts', summaryStats.countShortage.toLocaleString('en-IN'), 'Value of Shortage Parts', `Rs. ${formatNum(summaryStats.valueShortage)}`],
      ['Count of Excess Parts', summaryStats.countExcess.toLocaleString('en-IN'), 'Value of Excess Parts', `Rs. ${formatNum(summaryStats.valueExcess)}`],
      ['Total NDP Value before audit', `Rs. ${formatNum(summaryStats.totalNdpBefore)}`, 'Total NDP Value after audit', `Rs. ${formatNum(summaryStats.totalNdpAfter)}`],
      ['No of Line item counted', summaryStats.noLineItemsDup.toLocaleString('en-IN'), 'Count of Extras found during audit', summaryStats.extrasUnique.toLocaleString('en-IN')],
      ['No of Line item counted - Unique', summaryStats.noLineItemsUnique.toLocaleString('en-IN'), 'Total MRP Value after audit', `Rs. ${formatNum(summaryStats.totalMrpAfter)}`]
    ];

    const startX = 0.8;
    let startY = 1.7;
    const colW = [2.6, 1.3, 2.6, 1.3]; // Total width 7.8 inches

    // Site Name Header
    summarySlideShapes.push(cellShape(1000, team.siteName || 'Site Name', startX, startY, 7.8, 0.4, 1600, true, 'ctr', 'FFFFFF', '00B050', '004F98'));
    startY += 0.4;

    // Table body
    rowData.forEach((row, index) => {
      summarySlideShapes.push(cellShape(3000 + index * 4, row[0], startX, startY, colW[0], 0.35, 1000, true, 'l', 'FFFFFF', 'E2E8F0'));
      summarySlideShapes.push(cellShape(3001 + index * 4, row[1], startX + colW[0], startY, colW[1], 0.35, 1000, true, 'r', 'E6F2FF', 'E2E8F0'));
      summarySlideShapes.push(cellShape(3002 + index * 4, row[2], startX + colW[0] + colW[1], startY, colW[2], 0.35, 1000, true, 'l', 'FFFFFF', 'E2E8F0'));
      summarySlideShapes.push(cellShape(3003 + index * 4, row[3], startX + colW[0] + colW[1] + colW[2], startY, colW[3], 0.35, 1000, true, 'r', 'E6F2FF', 'E2E8F0'));
      startY += 0.35;
    });
  }

  slideEntries.push({
    shapes: summarySlideShapes.join(''),
    relationships: [...baseRelationships]
  });

  const frontImage = preparedImages.find((image) => image.imageType === 'front');
  const groupImage = preparedImages.find((image) => image.imageType === 'group');
  const siteRelationships = [...baseRelationships];
  const siteShapes = [baseSlideShapes('Front and Group Images')];
  [
    { label: 'Front image', remark: 'Front Remark:', image: frontImage, x: 0.55 },
    { label: 'Group image', remark: 'Group Remark:', image: groupImage, x: 5.1 }
  ].forEach((slot, index) => {
    siteShapes.push(textShape(20 + index, slot.label, slot.x, 0.95, 3.8, 0.25, 1300, true));
    siteShapes.push(textShape(40 + index, `${slot.remark} ${slot.image?.remarks || 'N/A'}`, slot.x, 1.25, 3.85, 0.3, 1100, true));
    if (slot.image) {
      const media = addMedia(slot.image.dataUrl, slot.image.extension);
      siteRelationships.push(relationship(media.relationshipId, 'image', media.target));
      siteShapes.push(imageShape(30 + index, media.relationshipId, slot.x, 1.65, 3.85, 2.35));
    }
  });
  slideEntries.push({ shapes: siteShapes.join(''), relationships: siteRelationships });

  categories.forEach((category) => {
    const beforeImages = preparedImages.filter((image) => image.imageType === 'before' && image.category === category.id);
    const afterImages = preparedImages.filter((image) => image.imageType === 'after' && image.category === category.id);
    if (!beforeImages.length && !afterImages.length) return;

    const maxRows = Math.max(beforeImages.length, afterImages.length);
    const addBeforeAfterPair = (
      shapes: string[],
      relationships: string[],
      pairIndex: number,
      y: number,
      imageHeight: number,
      includeRemarks: boolean
    ) => {
      const before = beforeImages[pairIndex];
      const after = afterImages[pairIndex];
      shapes.push(textShape(100 + pairIndex, `Before Image ${pairIndex + 1}`, 0.55, y, 3.8, 0.25, 1100, true));
      shapes.push(textShape(120 + pairIndex, `After Image ${pairIndex + 1}`, 5.1, y, 3.8, 0.25, 1100, true));

      if (includeRemarks) {
        shapes.push(textShape(180 + pairIndex, `Before Remark: ${before?.remarks || 'N/A'}`, 0.55, y + 0.3, 3.95, 0.26, 1000, true));
        shapes.push(textShape(200 + pairIndex, `After Remark: ${after?.remarks || 'N/A'}`, 5.1, y + 0.3, 3.95, 0.26, 1000, true));
        if (before) {
          const media = addMedia(before.dataUrl, before.extension);
          relationships.push(relationship(media.relationshipId, 'image', media.target));
          shapes.push(imageShape(140 + pairIndex, media.relationshipId, 0.55, y + 0.65, 3.8, imageHeight));
        }
        if (after) {
          const media = addMedia(after.dataUrl, after.extension);
          relationships.push(relationship(media.relationshipId, 'image', media.target));
          shapes.push(imageShape(160 + pairIndex, media.relationshipId, 5.1, y + 0.65, 3.8, imageHeight));
        }
      } else {
        const imageXLeft = 0.4;
        const imageXRight = 5.05;
        const imageWidth = 4.25;
        const imageTop = y + 0.22;
        if (before) {
          const media = addMedia(before.dataUrl, before.extension);
          relationships.push(relationship(media.relationshipId, 'image', media.target));
          shapes.push(imageShape(140 + pairIndex, media.relationshipId, imageXLeft, imageTop, imageWidth, imageHeight));
        }
        if (after) {
          const media = addMedia(after.dataUrl, after.extension);
          relationships.push(relationship(media.relationshipId, 'image', media.target));
          shapes.push(imageShape(160 + pairIndex, media.relationshipId, imageXRight, imageTop, imageWidth, imageHeight));
        }
      }
    };

    {
      const relationships = [...baseRelationships];
      const shapes = [baseSlideShapes(category.label)];
      addBeforeAfterPair(shapes, relationships, 0, 0.98, 2.45, true);
      slideEntries.push({ shapes: shapes.join(''), relationships });
    }

    for (let pairIndex = 1; pairIndex < maxRows; pairIndex += 1) {
      const relationships = [...baseRelationships];
      const shapes = [baseSlideShapes(category.label)];
      addBeforeAfterPair(shapes, relationships, pairIndex, 0.98, 1.65, false);
      slideEntries.push({ shapes: shapes.join(''), relationships });
    }
  });

  slideEntries.forEach((slide, index) => addSlide(zip, index + 1, slide.shapes, slide.relationships));
  mediaFiles.forEach((media) => {
    zip.file(`ppt/media/image${media.id}.${media.extension}`, media.data, { base64: true });
  });

  const slideIds = slideEntries.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('');
  const presentationRelationships = slideEntries
    .map((_, index) => relationship(`rId${index + 1}`, 'slide', `slides/slide${index + 1}.xml`))
    .join('') + relationship('rIdMaster', 'slideMaster', 'slideMasters/slideMaster1.xml');

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideEntries.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
</Types>`);
  zip.file('_rels/.rels', relsXml([
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    packageRelationship('rId2', 'metadata/core-properties', 'docProps/core.xml'),
    relationship('rId3', 'extended-properties', 'docProps/app.xml')
  ]));
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(fileBaseName(team))}</dc:title>
  <dc:creator>PAS System</dc:creator>
  <cp:lastModifiedBy>PAS System</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft PowerPoint</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slideEntries.length}</Slides>
  <Company>PAS System</Company>
</Properties>`);
  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="en-US"/></a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml([
    presentationRelationships,
    relationship('rIdPresProps', 'presProps', 'presProps.xml'),
    relationship('rIdViewProps', 'viewProps', 'viewProps.xml'),
    relationship('rIdTableStyles', 'tableStyles', 'tableStyles.xml')
  ]));
  zip.file('ppt/presProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:showPr showNarration="1">
    <p:present/>
  </p:showPr>
  <p:clrMru/>
</p:presentationPr>`);
  zip.file('ppt/viewProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr>
    <p:restoredLeft sz="15620"/>
    <p:restoredTop sz="94660"/>
  </p:normalViewPr>
  <p:slideViewPr>
    <p:cSldViewPr>
      <p:cViewPr varScale="1">
        <p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale>
        <p:origin x="0" y="0"/>
      </p:cViewPr>
      <p:guideLst/>
    </p:cSldViewPr>
  </p:slideViewPr>
  <p:notesTextViewPr>
    <p:cViewPr>
      <p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale>
      <p:origin x="0" y="0"/>
    </p:cViewPr>
  </p:notesTextViewPr>
  <p:gridSpacing cx="72008" cy="72008"/>
</p:viewPr>`);
  zip.file('ppt/tableStyles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', relsXml([
    relationship('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'),
    relationship('rId2', 'theme', '../theme/theme1.xml')
  ]));
  zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relsXml([
    relationship('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')
  ]));
  zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Focus">
  <a:themeElements>
    <a:clrScheme name="Focus"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="004F98"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="004F98"/></a:accent1><a:accent2><a:srgbClr val="10B981"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="6366F1"/></a:accent4><a:accent5><a:srgbClr val="EF4444"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6><a:hlink><a:srgbClr val="0066CC"/></a:hlink><a:folHlink><a:srgbClr val="475569"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Focus"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Focus">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
  saveAs(blob, `${fileBaseName(team)}.pptx`);
};

export const downloadTeamPostDocumentPptx = async (team: Team, summaryStats: SummaryStats | null = null) => {
  const [watermarkDataUrl, logoDataUrl, preparedImages] = await Promise.all([
    loadDataUrl(watermarkUrl),
    loadDataUrl(logoUrl),
    prepareImages(team)
  ]);

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'PAS System';
  pptx.company = 'PAS System';
  pptx.subject = 'Post Document of Stock Audit';
  pptx.title = fileBaseName(team);
  pptx.theme = {
    headFontFace: 'Arial',
    bodyFontFace: 'Arial'
  };

  const headerLogo = { x: 7.95, y: 0.22, w: 1.35, h: 0.64 };
  const headerTitle = { x: 0.55, y: 0.34, w: 7.1, h: 0.34 };
  const coverLogo = { x: 7.4, y: 0.48, w: 1.9, h: 0.78 };

  const addBase = (slide: pptxgen.Slide, title?: string) => {
    slide.background = { color: 'FFFFFF' };
    slide.addImage({ data: watermarkDataUrl, x: 2.6, y: 1.1, w: 4.8, h: 4.0, transparency: 88 });
    slide.addImage({ data: logoDataUrl, ...headerLogo });
    if (title) {
      slide.addText(title, {
        ...headerTitle,
        fontFace: 'Arial',
        fontSize: 15,
        bold: true,
        color: '111827',
        margin: 0
      });
    }
  };

  const addCell = (
    slide: pptxgen.Slide,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    options: {
      fontSize?: number;
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
      fill?: string;
      border?: string;
      color?: string;
    } = {}
  ) => {
    slide.addText(text, {
      x,
      y,
      w,
      h,
      fontFace: 'Arial',
      fontSize: options.fontSize || 10,
      bold: options.bold,
      color: options.color || '000000',
      align: options.align || 'left',
      valign: 'middle',
      margin: 0.05,
      fit: 'shrink',
      fill: options.fill ? { color: options.fill } : { transparency: 100 },
      line: options.border ? { color: options.border, width: 0.5 } : { transparency: 100 }
    });
  };

  const addImageOrBox = (
    slide: pptxgen.Slide,
    image: PreparedImage | undefined,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    if (image) {
      slide.addImage({ data: image.dataUrl, x, y, w, h, sizing: { type: 'contain', x, y, w, h } });
      return;
    }

    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      fill: { color: 'FFFFFF', transparency: 100 },
      line: { color: 'CBD5E1', width: 1 }
    });
    slide.addText('No image uploaded', {
      x,
      y: y + h / 2 - 0.12,
      w,
      h: 0.25,
      fontFace: 'Arial',
      fontSize: 10,
      color: '64748B',
      align: 'center',
      margin: 0
    });
  };

  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: 'FFFFFF' };
  coverSlide.addImage({ data: watermarkDataUrl, x: 2.15, y: 2.55, w: 5.4, h: 2.35, transparency: 87 });
  coverSlide.addImage({ data: logoDataUrl, ...coverLogo });
  addCell(coverSlide, 'Post Document of Stock Audit', 0, 3.08, 10, 0.5, {
    fontSize: 23,
    bold: true,
    align: 'center',
    color: '003C54'
  });
  addCell(coverSlide, team.siteName || 'Current Team', 0, 3.7, 10, 0.4, {
    fontSize: 18,
    bold: true,
    align: 'center',
    color: '003C54'
  });

  const summarySlide = pptx.addSlide();
  addBase(summarySlide, 'Audit Summary');
  const endDateDisplay = team.status === 'Completed' ? formatDate(team.auditEndDate || team.updatedAt) : 'Not completed yet';
  addCell(summarySlide, `Audit Start Date: ${formatDate(team.auditStartDate || team.createdAt)}`, 0.8, 0.9, 7.8, 0.3, {
    fontSize: 12,
    bold: true
  });
  addCell(summarySlide, `Audit End Date: ${endDateDisplay}`, 0.8, 1.25, 7.8, 0.3, {
    fontSize: 12,
    bold: true
  });

  if (summaryStats) {
    const formatNum = (value: number) => value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const rowData = [
      ['Count of Part No. before audit', summaryStats.countPartNoBefore.toLocaleString('en-IN'), 'Count of Part No. after audit', summaryStats.countPartNoAfter.toLocaleString('en-IN')],
      ['Count of Shortage Parts', summaryStats.countShortage.toLocaleString('en-IN'), 'Value of Shortage Parts', `Rs. ${formatNum(summaryStats.valueShortage)}`],
      ['Count of Excess Parts', summaryStats.countExcess.toLocaleString('en-IN'), 'Value of Excess Parts', `Rs. ${formatNum(summaryStats.valueExcess)}`],
      ['Total NDP Value before audit', `Rs. ${formatNum(summaryStats.totalNdpBefore)}`, 'Total NDP Value after audit', `Rs. ${formatNum(summaryStats.totalNdpAfter)}`],
      ['No of Line item counted', summaryStats.noLineItemsDup.toLocaleString('en-IN'), 'Count of Extras found during audit', summaryStats.extrasUnique.toLocaleString('en-IN')],
      ['No of Line item counted - Unique', summaryStats.noLineItemsUnique.toLocaleString('en-IN'), 'Total MRP Value after audit', `Rs. ${formatNum(summaryStats.totalMrpAfter)}`]
    ];

    const startX = 0.8;
    let startY = 1.7;
    const colW = [2.6, 1.3, 2.6, 1.3];
    addCell(summarySlide, team.siteName || 'Site Name', startX, startY, 7.8, 0.4, {
      fontSize: 16,
      bold: true,
      align: 'center',
      fill: 'FFFFFF',
      border: '00B050',
      color: '004F98'
    });
    startY += 0.4;

    rowData.forEach((row) => {
      addCell(summarySlide, row[0], startX, startY, colW[0], 0.35, { fontSize: 10, bold: true, fill: 'FFFFFF', border: 'E2E8F0' });
      addCell(summarySlide, row[1], startX + colW[0], startY, colW[1], 0.35, { fontSize: 10, bold: true, align: 'right', fill: 'E6F2FF', border: 'E2E8F0' });
      addCell(summarySlide, row[2], startX + colW[0] + colW[1], startY, colW[2], 0.35, { fontSize: 10, bold: true, fill: 'FFFFFF', border: 'E2E8F0' });
      addCell(summarySlide, row[3], startX + colW[0] + colW[1] + colW[2], startY, colW[3], 0.35, { fontSize: 10, bold: true, align: 'right', fill: 'E6F2FF', border: 'E2E8F0' });
      startY += 0.35;
    });
  }

  const frontImage = preparedImages.find((image) => image.imageType === 'front');
  const groupImage = preparedImages.find((image) => image.imageType === 'group');
  const siteSlide = pptx.addSlide();
  addBase(siteSlide, 'Front and Group Images');
  [
    { label: 'Front image', remark: 'Front Remark:', image: frontImage, x: 0.55 },
    { label: 'Group image', remark: 'Group Remark:', image: groupImage, x: 5.1 }
  ].forEach((slot) => {
    addCell(siteSlide, slot.label, slot.x, 0.95, 3.8, 0.25, { fontSize: 13, bold: true });
    addCell(siteSlide, `${slot.remark} ${slot.image?.remarks || 'N/A'}`, slot.x, 1.22, 3.85, 0.38, { fontSize: 11, bold: true });
    addImageOrBox(siteSlide, slot.image, slot.x, 1.65, 3.85, 2.35);
  });

  categories.forEach((category) => {
    const beforeImages = preparedImages.filter((image) => image.imageType === 'before' && image.category === category.id);
    const afterImages = preparedImages.filter((image) => image.imageType === 'after' && image.category === category.id);
    if (!beforeImages.length && !afterImages.length) return;

    const addBeforeAfterPair = (
      slide: pptxgen.Slide,
      pairIndex: number,
      y: number,
      imageHeight: number,
      includeRemarks: boolean,
      imageWidth = 3.8
    ) => {
      const before = beforeImages[pairIndex];
      const after = afterImages[pairIndex];
      slide.addText(`Before Image ${pairIndex + 1}`, {
        x: 0.55,
        y,
        w: 3.8,
        h: 0.25,
        fontFace: 'Arial',
        fontSize: 11,
        bold: true,
        color: '000000',
        margin: 0,
        fit: 'shrink'
      });
      slide.addText(`After Image ${pairIndex + 1}`, {
        x: 5.1,
        y,
        w: 3.8,
        h: 0.25,
        fontFace: 'Arial',
        fontSize: 11,
        bold: true,
        color: '000000',
        margin: 0,
        fit: 'shrink'
      });

      if (includeRemarks) {
        addCell(slide, `Before Remark: ${before?.remarks || 'N/A'}`, 0.55, y + 0.3, 3.85, 0.34, { fontSize: 9, bold: true, fill: 'FFFFFF', border: 'FFFFFF' });
        addCell(slide, `After Remark: ${after?.remarks || 'N/A'}`, 5.1, y + 0.3, 3.85, 0.34, { fontSize: 9, bold: true, fill: 'FFFFFF', border: 'FFFFFF' });
        addImageOrBox(slide, before, 0.55, y + 0.65, 3.8, imageHeight);
        addImageOrBox(slide, after, 5.1, y + 0.65, 3.8, imageHeight);
      } else {
        addImageOrBox(slide, before, 0.4, y + 0.22, imageWidth, imageHeight);
        addImageOrBox(slide, after, 5.05, y + 0.22, imageWidth, imageHeight);
      }
    };

    const firstSlide = pptx.addSlide();
    addBase(firstSlide, category.label);
    addBeforeAfterPair(firstSlide, 0, 0.98, 2.45, true);

    for (let pairIndex = 1; pairIndex < Math.max(beforeImages.length, afterImages.length); pairIndex += 1) {
      const slide = pptx.addSlide();
      addBase(slide, category.label);
      addBeforeAfterPair(slide, pairIndex, 1.05, 2.95, false, 4.25);
    }
  });

  await pptx.writeFile({ fileName: `${fileBaseName(team)}.pptx` });
};
