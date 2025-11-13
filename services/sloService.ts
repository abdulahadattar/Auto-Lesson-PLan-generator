import { SLO } from '../types';

/**
 * Parses a text content to extract Student Learning Outcomes (SLOs).
 * It first looks for JSON code blocks. If none are found, it tries to parse the whole text.
 * @param text The string content to parse.
 * @returns An array of all found SLOs.
 */
export function parseSloText(text: string): SLO[] {
  const slos: SLO[] = [];
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  let foundJsonBlock = false;

  while ((match = jsonRegex.exec(text)) !== null) {
    foundJsonBlock = true;
    try {
      const jsonContent = JSON.parse(match[1]);
      if (Array.isArray(jsonContent)) {
        if (jsonContent.length > 0 && jsonContent[0].SLO_ID && jsonContent[0].SLO_Text) {
          slos.push(...jsonContent);
        }
      }
    } catch (e) {
      console.warn(`Skipping invalid JSON block`, e);
    }
  }

  // If no JSON block was found, try parsing the entire file content as JSON.
  if (!foundJsonBlock) {
    try {
      const fullContent = JSON.parse(text);
      if (Array.isArray(fullContent)) {
        if (fullContent.length > 0 && fullContent[0].SLO_ID && fullContent[0].SLO_Text) {
          slos.push(...fullContent);
        }
      }
    } catch (e2) {
      // This is not an error if the file is not a json file, so silently fail
    }
  }

  return slos;
}


/**
 * Parses uploaded files to extract Student Learning Outcomes (SLOs).
 * It reads text files, looks for JSON code blocks, and parses them into SLO objects.
 * It also assigns a grade level based on the filename.
 * @param files An array of File objects to parse.
 * @returns A promise that resolves to an array of all found SLOs.
 */
export async function parseSloFiles(files: File[]): Promise<SLO[]> {
  const sloFiles = files.filter(file => 
    file.type === 'text/plain' || file.name.endsWith('.txt') ||
    file.type === 'application/json' || file.name.endsWith('.json')
  );
  
  const parsedSloArrays = await Promise.all(
    sloFiles.map(async (file) => {
      try {
        const text = await file.text();
        const slos = parseSloText(text);
        
        let grade: string | undefined = undefined;
        const fileNameLower = file.name.toLowerCase();

        if (fileNameLower.includes("grade_9")) {
            grade = 'Grade 9';
        } else if (fileNameLower.includes("grade_10")) {
            grade = 'Grade 10';
        } else if (fileNameLower.includes("grade_11")) {
            grade = 'Grade 11';
        } else if (fileNameLower.includes("grade_12")) {
            grade = 'Grade 12';
        }
        
        // Add grade to each SLO from this file if a grade was determined
        if (grade) {
          return slos.map(slo => ({ ...slo, grade }));
        }
        
        return slos;
      } catch (error) {
        console.error(`Error reading or parsing file ${file.name}`, error);
        return []; // Return empty array on error for this file
      }
    })
  );
  
  // Flatten the array of arrays into a single array of SLOs
  return parsedSloArrays.flat();
}