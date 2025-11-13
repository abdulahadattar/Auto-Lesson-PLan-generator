
export interface Activity {
  name: string;
  duration: number; // Duration in minutes
  description: string;
}

export interface LessonPlan {
  title: string;
  objective: string;
  gradeLevel: string;
  subject: string;
  materials: string[];
  activities: Activity[];
  assessment: string;
  homework: string;
  summary: string;
}

export interface SLO {
  SLO_ID: string;
  Unit_Name: string;
  SLO_Text: string;
  grade?: string;
  Section_Name: string;
  Unit_Number: string;
  Cognitive_Level_Code: string;
  uniqueId?: string;
}

export type GroupedSlos = Record<string, SLO[]>;

export interface ManagedFile {
  file: File;
  status: 'ready' | 'error';
  error?: string;
}
