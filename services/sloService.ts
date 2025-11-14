
import { SLO } from '../types';

/**
 * Loads the predefined SLO files from the SLOschema directory.
 * @returns A promise that resolves to an array of all SLOs from the predefined files.
 */
export async function loadInitialSlos(): Promise<SLO[]> {
  const gradeFiles = [
    { grade: 'Grade 9', path: './SLOschema/Grade_9.json' },
    { grade: 'Grade 10', path: './SLOschema/Grade_10.json' },
    { grade: 'Grade 11', path: './SLOschema/Grade_11.json' },
    { grade: 'Grade 12', path: './SLOschema/Grade_12.json' },
  ];
  
  const parsedSloArrays = await Promise.all(
    gradeFiles.map(async ({ grade, path }) => {
      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }
        const slos = await response.json();
        
        // Add grade to each SLO from this file
        return slos.map((slo: Omit<SLO, 'grade'>) => ({ ...slo, grade }));
      } catch (error) {
        console.error(`Error loading or parsing SLO file ${path}`, error);
        return []; // Return empty array on error for this file
      }
    })
  );
  
  // Flatten the array of arrays into a single array of SLOs
  return parsedSloArrays.flat();
}
