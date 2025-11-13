import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  IRunOptions
} from 'docx';
import saveAs from 'file-saver';
import { LessonPlan, Activity, SLO } from '../types';

// Declaration for pdfmake, which is loaded via a script tag in index.html
declare const pdfMake: any;

// --- UTILITY FUNCTIONS ---

const formatFileName = (title: string, sloId?: string): string => {
  const baseName = sloId ? `${sloId}_${title}` : title;
  // Replace invalid characters for file names and limit length
  return baseName.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);
};

/**
 * Parses a string with markdown-like formatting (**bold**, *italic*) and LaTeX-like
 * math equations ($...$ or $$...$$) into an array of TextRun objects for docx.
 * @param text The input string.
 * @returns An array of TextRun objects.
 */
const parseTextForDocx = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    // Regex to capture markdown bold/italic and LaTeX math.
    // The inline math regex `$[^\s](?:[^\$]*[^\s])?\$` is more specific to avoid matching currency.
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\s](?:[^\$]*[^\s])?\$|\*\*.*?\*\*|\*.*?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add plain text before the matched special format
        if (match.index > lastIndex) {
            runs.push(new TextRun({ text: text.substring(lastIndex, match.index), font: "Calibri", size: 22 }));
        }

        const matchedText = match[0];
        if (matchedText.startsWith('$$') && matchedText.endsWith('$$')) {
            // Display Math
            runs.push(new TextRun({ text: matchedText.slice(2, -2).trim(), bold: true, font: "Cambria Math", size: 24 }));
        } else if (matchedText.startsWith('$') && matchedText.endsWith('$')) {
            // Inline Math
            runs.push(new TextRun({ text: matchedText.slice(1, -1), bold: true, font: "Cambria Math", size: 22 }));
        } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
            // Bold
            runs.push(new TextRun({ text: matchedText.slice(2, -2), bold: true, font: "Calibri", size: 22 }));
        } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
            // Italic
            runs.push(new TextRun({ text: matchedText.slice(1, -1), italics: true, font: "Calibri", size: 22 }));
        }
        
        lastIndex = match.index + matchedText.length;
    }

    // Add any remaining plain text after the last match
    if (lastIndex < text.length) {
        runs.push(new TextRun({ text: text.substring(lastIndex), font: "Calibri", size: 22 }));
    }

    return runs;
};


const createRichParagraph = (text: string): Paragraph => {
  return new Paragraph({
      children: parseTextForDocx(text),
      spacing: { after: 100 },
      alignment: AlignmentType.JUSTIFIED,
  });
};

const createBulletList = (items: string[]): Paragraph[] => {
  return items.map(item => new Paragraph({
      children: parseTextForDocx(item),
      bullet: { level: 0 },
      spacing: { after: 50 },
  }));
};

const createSectionHeading = (title: string): Paragraph => {
  return new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 28, color: "1F4E79" })],
      spacing: { before: 300, after: 100 },
      alignment: AlignmentType.LEFT,
      // FIX: The property for border style is `style`, not `value`.
      border: { bottom: { color: "1F4E79", space: 4, style: "single", size: 6 } }
  });
};

const createHeaderRun = (text: string, bold: boolean = false, size: number = 20): TextRun => {
  return new TextRun({
      text: text,
      bold: bold,
      size: size, 
      font: "Calibri",
  });
};

// --- DOCX Export ---
export const exportAsDocx = async (lessonPlan: LessonPlan, sloId?: string): Promise<void> => {
    const fileName = `${formatFileName(lessonPlan.title, sloId)}.docx`;
    
    const teacherName = "Abdul Ahad"; 
    const schoolPlaceholder = "EDUCATIONAL INSTITUTION NAME"; 
    const dateTimeline = '____________________'; 
    const period = '1';
    const gradeShort = lessonPlan.gradeLevel.split(' ')[0];
    
    const narrowMargin = 567; // approx 1 cm 

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [createHeaderRun(schoolPlaceholder, true, 24)],
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({
                                children: [createHeaderRun('DAILY LESSON PLAN', true, 36)],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 50 }
                            }),
                        ],
                        columnSpan: 4,
                        borders: { top: { style: 'single', size: 12 }, bottom: { style: 'single', size: 12 }, left: { style: 'none'}, right: { style: 'none'} }
                    }),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`GRADE: ${gradeShort}`, true, 24)] })], verticalAlign: VerticalAlign.CENTER, borders: {top: {style: 'none'}, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'}} }),
                    new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`SUBJECT: ${lessonPlan.subject}`, true, 24)] })], verticalAlign: VerticalAlign.CENTER, borders: {top: {style: 'none'}, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'}} }),
                    new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`PERIODS: ${period}`, true, 24)] })], verticalAlign: VerticalAlign.CENTER, borders: {top: {style: 'none'}, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'}} }),
                    new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`DATE/TIMELINE: ${dateTimeline}`, true, 24)] })], verticalAlign: VerticalAlign.CENTER, borders: {top: {style: 'none'}, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'}} }),
                ],
            }),
            new TableRow({
                children: [ new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`LESSON TOPIC: ${lessonPlan.title}`, false, 24)] })], columnSpan: 4, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: 'single', size: 6 }, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'} } })],
            }),
            new TableRow({
                children: [ new TableCell({ children: [new Paragraph({ children: [createHeaderRun(`LEARNING OBJECTIVE: ${lessonPlan.objective}`, false, 24)] })], columnSpan: 4, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: 'single', size: 2 }, bottom: {style: 'none'}, left: {style: 'none'}, right: {style: 'none'} } })],
            }),
            new TableRow({
                children: [
                    new TableCell({
                        children: [ new Paragraph({ children: [createHeaderRun(`TEACHER: `, false, 24), createHeaderRun(teacherName, true, 24)] })],
                        columnSpan: 4, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: 'single', size: 2 }, bottom: { style: 'single', size: 12 }, left: {style: 'none'}, right: {style: 'none'} }
                    }),
                ],
            }),
        ],
    });

    const children: (Paragraph | Table)[] = [headerTable];
    
    children.push(createSectionHeading('SUMMARY'));
    children.push(createRichParagraph(lessonPlan.summary));

    children.push(createSectionHeading('RESOURCES'));
    if (lessonPlan.materials.length > 0) {
        children.push(...createBulletList(lessonPlan.materials));
    } else {
        children.push(createRichParagraph('No materials required.'));
    }

    children.push(createSectionHeading('LESSON PROCEDURE & TIMINGS'));
    lessonPlan.activities.forEach(activity => {
        children.push(new Paragraph({ 
            children: [ new TextRun({ text: `${activity.name.toUpperCase()} (${activity.duration} mins)`, bold: true, size: 24 })],
            spacing: { before: 200, after: 100 }
        }));
        children.push(createRichParagraph(activity.description));
    });
    
    children.push(createSectionHeading('ASSESSMENT'));
    children.push(createRichParagraph(lessonPlan.assessment));

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: narrowMargin, right: narrowMargin, bottom: narrowMargin, left: narrowMargin }}},
            children: children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);
};


// --- PDF Export ---
export const exportAsPdf = async (lessonPlan: LessonPlan, sloId?: string): Promise<void> => {
    const fileName = `${formatFileName(lessonPlan.title, sloId)}.pdf`;
    
    const teacherName = "Abdul Ahad";
    const schoolPlaceholder = "People’s Higher Secondary School, Jamshoro";
    const dateTimeline = '____________________';
    const period = '__';
    const gradeShort = lessonPlan.gradeLevel.split(' ')[0];

    const parseTextForPdf = (text: string): any[] => {
        const parts: any[] = [];
        // Regex to capture markdown bold/italic and LaTeX math.
        // The inline math regex `$[^\s](?:[^\$]*[^\s])?\$` is more specific to avoid matching currency.
        const regex = /(\$\$[\s\S]*?\$\$|\$[^\s](?:[^\$]*[^\s])?\$|\*\*.*?\*\*|\*.*?\*)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ text: text.substring(lastIndex, match.index) });
            }
            const matchedText = match[0];
            if (matchedText.startsWith('$$') && matchedText.endsWith('$$')) {
                parts.push({ text: matchedText.slice(2, -2).trim(), bold: true, italics: true, fontSize: 12 });
            } else if (matchedText.startsWith('$') && matchedText.endsWith('$')) {
                parts.push({ text: matchedText.slice(1, -1), bold: true, italics: true });
            } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
                parts.push({ text: matchedText.slice(2, -2), bold: true });
            } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
                parts.push({ text: matchedText.slice(1, -1), italics: true });
            }
            lastIndex = match.index + matchedText.length;
        }
        if (lastIndex < text.length) {
            parts.push({ text: text.substring(lastIndex) });
        }
        return parts;
    };
    
    const createPdfRichText = (text: string) => ({ text: parseTextForPdf(text), style: 'body' });

    const docDefinition: any = {
        pageMargins: [15, 5, 15, 5], // [left, top, right, bottom]
        content: [
            {
                layout: 'lightHorizontalLines',
                table: {
                    widths: ['*', '*', '*', '*'],
                    body: [
                        [{ colSpan: 4, text: `${schoolPlaceholder}\nDAILY LESSON PLAN`, style: 'headerTableTitle' }, {}, {}, {}],
                        [{ text: `GRADE: ${gradeShort}`, style: 'headerTableBody' }, { text: `SUBJECT: ${lessonPlan.subject}`, style: 'headerTableBody' }, { text: `PERIODS: ${period}`, style: 'headerTableBody' }, { text: `DATE/TIMELINE: ${dateTimeline}`, style: 'headerTableBody' }],
                        [{ colSpan: 4, text: `LESSON TOPIC: ${lessonPlan.title}`, style: 'headerTableBody' }, {}, {}, {}],
                        [{ colSpan: 4, text: `LEARNING OBJECTIVE: ${lessonPlan.objective}`, style: 'headerTableBody' }, {}, {}, {}],
                        [{ colSpan: 4, text: `TEACHER: ${teacherName}`, style: 'headerTableBody' }, {}, {}, {}],
                    ]
                },
                margin: [0, 0, 0, 10] 
            },

            { text: 'SUMMARY', style: 'sectionHeader' },
            createPdfRichText(lessonPlan.summary),
            
            { text: 'RESOURCES', style: 'sectionHeader' },
            { ul: lessonPlan.materials.length > 0 ? lessonPlan.materials.map(m => createPdfRichText(m)) : [{ text: 'No materials required.', style: 'body' }] },
            
            { text: 'LESSON PROCEDURE & TIMINGS', style: 'sectionHeader' },
            ...lessonPlan.activities.map(activity => ([
                { text: `${activity.name.toUpperCase()} (${activity.duration} mins)`, bold: true, margin: [0, 8, 0, 4] },
                createPdfRichText(activity.description)
            ])).flat(), 
            
        ],
        styles: {
            headerTableTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
            headerTableBody: { fontSize: 9, bold: true, alignment: 'left' },
            sectionHeader: { fontSize: 12, bold: true, color: '#1F4E79', margin: [0, 15, 0, 5], decoration: 'underline', decorationColor: '#1F4E79' },
            body: { fontSize: 10, lineHeight: 1.2, alignment: 'justify' },
        },
        defaultStyle: { font: 'Roboto' }
    };

    pdfMake.createPdf(docDefinition).download(fileName);
};