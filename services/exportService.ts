
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
  PageBreak,
  ISectionOptions,
} from 'docx';
import saveAs from 'file-saver';
import { LessonPlan, Activity } from '../types';

// Declaration for pdfmake, which is loaded via a script tag in index.html
declare const pdfMake: any;

// --- UTILITY FUNCTIONS ---

export const formatFileName = (title: string, sloId?: string): string => {
  const baseName = sloId ? `${sloId}_${title}` : title;
  return baseName.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);
};

// --- DOCX PARSING AND HELPERS ---

const parseTextForDocx = (text: string): TextRun[] => {
  const runs: TextRun[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\s](?:[^\$]*[^\s])?\$|\*\*.*?\*\*|\*.*?\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.substring(lastIndex, match.index), font: "Calibri", size: 22 }));
    }
    const matchedText = match[0];
    if (matchedText.startsWith('$$') && matchedText.endsWith('$$')) {
      runs.push(new TextRun({ text: matchedText.slice(2, -2).trim(), bold: true, font: "Cambria Math", size: 24 }));
    } else if (matchedText.startsWith('$') && matchedText.endsWith('$')) {
      runs.push(new TextRun({ text: matchedText.slice(1, -1), bold: true, font: "Cambria Math", size: 22 }));
    } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
      runs.push(new TextRun({ text: matchedText.slice(2, -2), bold: true, font: "Calibri", size: 22 }));
    } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
      runs.push(new TextRun({ text: matchedText.slice(1, -1), italics: true, font: "Calibri", size: 22 }));
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.substring(lastIndex), font: "Calibri", size: 22 }));
  }
  return runs;
};

const createRichParagraph = (text: string): Paragraph => new Paragraph({
  children: parseTextForDocx(text),
  spacing: { after: 100 },
  alignment: AlignmentType.JUSTIFIED,
});

const createBulletList = (items: string[]): Paragraph[] => items.map(item => new Paragraph({
  children: parseTextForDocx(item),
  bullet: { level: 0 },
  spacing: { after: 50 },
}));

const createSectionHeading = (title: string): Paragraph => new Paragraph({
  children: [new TextRun({ text: title, bold: true, size: 28, color: "1F4E79" })],
  spacing: { before: 300, after: 100 },
  alignment: AlignmentType.LEFT,
  border: { bottom: { color: "1F4E79", space: 4, style: "single", size: 6 } }
});

const createHeaderRun = (text: string, bold: boolean = false, size: number = 20): TextRun => new TextRun({
  text,
  bold,
  size,
  font: "Calibri",
});

const createDocxContentForPlan = (lessonPlan: LessonPlan): (Paragraph | Table)[] => {
  const teacherName = "Abdul Ahad"; 
  const schoolPlaceholder = "EDUCATIONAL INSTITUTION NAME"; 
  const dateTimeline = '____________________'; 
  const period = '1';
  const gradeShort = lessonPlan.gradeLevel.split(' ')[0];
  
  const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
          new TableRow({
              children: [
                  new TableCell({
                      children: [
                          new Paragraph({ children: [createHeaderRun(schoolPlaceholder, true, 24)], alignment: AlignmentType.CENTER }),
                          new Paragraph({ children: [createHeaderRun('DAILY LESSON PLAN', true, 36)], alignment: AlignmentType.CENTER, spacing: { after: 50 } }),
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
  children.push(createSectionHeading('RESOURCES'));
  children.push(...(lessonPlan.materials.length > 0 ? createBulletList(lessonPlan.materials) : [createRichParagraph('No materials required.')]));
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
  return children;
};

// --- PDF PARSING AND HELPERS ---

const parseTextForPdf = (text: string): any[] => {
    const parts: any[] = [];
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

const createPdfContentForPlan = (lessonPlan: LessonPlan): any[] => {
    const teacherName = "Abdul Ahad";
    const schoolPlaceholder = "People’s Higher Secondary School, Jamshoro";
    const dateTimeline = '____________________';
    const period = '__';
    const gradeShort = lessonPlan.gradeLevel.split(' ')[0];

    const headerTable = {
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
    };
    
    const resourcesSection = [
        { text: 'RESOURCES', style: 'sectionHeader' },
        { ul: lessonPlan.materials.length > 0 ? lessonPlan.materials.map(m => createPdfRichText(m)) : [{ text: 'No materials required.', style: 'body' }] },
    ];

    const procedureSection = [
        { text: 'LESSON PROCEDURE & TIMINGS', style: 'sectionHeader' },
        ...lessonPlan.activities.flatMap(activity => ([
            { text: `${activity.name.toUpperCase()} (${activity.duration} mins)`, bold: true, margin: [0, 8, 0, 4] },
            createPdfRichText(activity.description)
        ])),
    ];

    return [headerTable, ...resourcesSection, ...procedureSection];
};

// --- SINGLE EXPORT FUNCTIONS ---

export const exportAsDocx = async (lessonPlan: LessonPlan, sloId?: string): Promise<void> => {
  const fileName = `${formatFileName(lessonPlan.title, sloId)}.docx`;
  const narrowMargin = 567;
  const children = createDocxContentForPlan(lessonPlan);
  const doc = new Document({
      sections: [{
          properties: { page: { margin: { top: narrowMargin, right: narrowMargin, bottom: narrowMargin, left: narrowMargin }}},
          children: children,
      }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
};

export const exportAsPdf = async (lessonPlan: LessonPlan, sloId?: string): Promise<void> => {
    const fileName = `${formatFileName(lessonPlan.title, sloId)}.pdf`;
    const content = createPdfContentForPlan(lessonPlan);
    const docDefinition: any = {
        pageMargins: [15, 5, 15, 5],
        content: content,
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

// --- MULTIPLE EXPORT FUNCTIONS ---

export const exportMultipleLessonsAsDocx = async (lessonPlans: LessonPlan[], fileName: string): Promise<void> => {
    const narrowMargin = 567;
    const sections: ISectionOptions[] = lessonPlans.map((plan, index) => ({
        properties: { 
            page: { margin: { top: narrowMargin, right: narrowMargin, bottom: narrowMargin, left: narrowMargin } },
            pageBreakBefore: index > 0,
        },
        children: createDocxContentForPlan(plan),
    }));

    const doc = new Document({ sections });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${fileName}.docx`);
};

export const exportMultipleLessonsAsPdf = async (lessonPlans: LessonPlan[], fileName: string): Promise<void> => {
    const allContent = lessonPlans.flatMap((plan, index) => {
        const content = createPdfContentForPlan(plan);
        if (index > 0) {
            return [{ text: '', pageBreak: 'before' as const }, ...content];
        }
        return content;
    });

    const docDefinition: any = {
        pageMargins: [15, 5, 15, 5],
        content: allContent,
        styles: {
            headerTableTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
            headerTableBody: { fontSize: 9, bold: true, alignment: 'left' },
            sectionHeader: { fontSize: 12, bold: true, color: '#1F4E79', margin: [0, 15, 0, 5], decoration: 'underline', decorationColor: '#1F4E79' },
            body: { fontSize: 10, lineHeight: 1.2, alignment: 'justify' },
        },
        defaultStyle: { font: 'Roboto' }
    };

    pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
};
