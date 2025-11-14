
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SLO, GroupedSlos, LessonPlan } from './types';
import { generateLessonPlan } from './services/geminiService';
import { loadInitialSlos } from './services/sloService';
import InputPanel from './components/InputPanel';
import { InfoIcon, BrandIcon, MenuIcon, CloseIcon } from './components/icons/MiscIcons';
import { FileIcon } from './components/icons/FileIcon';
import { exportAsPdf, exportAsDocx } from './services/exportService';
import { Part } from '@google/genai';

interface UnitsByGrade {
  [grade: string]: GroupedSlos;
}

interface ContextPdf {
    name: string;
    grade: string;
    unit: string;
    file: File;
}

// --- SloPanel Component ---
interface SloPanelProps {
  unitsByGrade: UnitsByGrade;
  selectedSloUniqueIds: string[];
  setSelectedSloUniqueIds: React.Dispatch<React.SetStateAction<string[]>>;
  isLoading: boolean;
  onGenerate: () => void;
  isParsing: boolean;
  generationProgress: { current: number; total: number } | null;
  areFilesReady: boolean;
}

const SloPanel: React.FC<SloPanelProps> = ({ unitsByGrade, selectedSloUniqueIds, setSelectedSloUniqueIds, isLoading, onGenerate, isParsing, generationProgress, areFilesReady }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUnitsByGrade = useMemo(() => {
    if (!searchQuery.trim()) {
      return unitsByGrade;
    }
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    const filterSlos = (slos: SLO[]) => slos.filter(slo =>
      slo.SLO_ID.toLowerCase().includes(lowerCaseQuery) ||
      slo.SLO_Text.toLowerCase().includes(lowerCaseQuery)
    );

    const filterGrade = (gradeUnits: GroupedSlos): GroupedSlos => {
      return Object.entries(gradeUnits)
        .map(([unitName, slos]) => ({ unitName, slos: filterSlos(slos) }))
        .filter(({ slos }) => slos.length > 0)
        .reduce<GroupedSlos>((acc, { unitName, slos }) => {
          acc[unitName] = slos;
          return acc;
        }, {} as GroupedSlos);
    };

    return Object.entries(unitsByGrade)
      .map(([grade, units]) => ({ grade, units: filterGrade(units) }))
      .filter(({ units }) => Object.keys(units).length > 0)
      .reduce<UnitsByGrade>((acc, { grade, units }) => {
        acc[grade] = units;
        return acc;
      }, {} as UnitsByGrade);
  }, [unitsByGrade, searchQuery]);


  const handleSelectionToggle = (slosToToggle: SLO[], currentlySelectedIds: string[]) => {
    const idsToToggle = slosToToggle.map(slo => slo.uniqueId!);
    const allCurrentlySelected = idsToToggle.every(id => currentlySelectedIds.includes(id));
    
    if (allCurrentlySelected) {
      return currentlySelectedIds.filter(id => !idsToToggle.includes(id));
    } else {
      return [...new Set([...currentlySelectedIds, ...idsToToggle])];
    }
  };

  const handleSloSelection = (uniqueId: string) => {
    setSelectedSloUniqueIds(prev =>
      prev.includes(uniqueId)
        ? prev.filter(id => id !== uniqueId)
        : [...prev, uniqueId]
    );
  };
  
  const handleUnitSelection = (slosInUnit: SLO[]) => {
    setSelectedSloUniqueIds(prev => handleSelectionToggle(slosInUnit, prev));
  };

  const handleGradeSelection = (slosInGrade: SLO[]) => {
      setSelectedSloUniqueIds(prev => handleSelectionToggle(slosInGrade, prev));
  };

  const ParentCheckbox: React.FC<{ slos: SLO[]; onToggle: (slos: SLO[]) => void }> = ({ slos, onToggle }) => {
    const selectedCount = slos.filter(slo => selectedSloUniqueIds.includes(slo.uniqueId!)).length;
    const isAllSelected = selectedCount === slos.length;
    const isIndeterminate = selectedCount > 0 && selectedCount < slos.length;
    const checkboxRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    return (
      <input 
        type="checkbox"
        ref={checkboxRef}
        checked={isAllSelected}
        onChange={() => onToggle(slos)}
        className="form-checkbox h-4 w-4 text-brand-primary bg-brand-dark border-brand-gray rounded focus:ring-brand-primary/50"
        aria-label={`Select all SLOs`}
      />
    );
  };
  
  if (isParsing) {
    return (
      <div className="flex-1 p-6 bg-brand-dark rounded-xl flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-brand-primary mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-brand-gray">Loading curriculum data...</p>
        </div>
      </div>
    );
  }

  const hasSlos = Object.keys(unitsByGrade).length > 0;

  return (
    <div className="flex-1 p-6 bg-[#1e1f22] rounded-xl flex flex-col">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-xl font-bold text-gray-200 mb-1">Student Learning Outcomes (SLOs)</h2>
        <p className="text-sm text-brand-gray">Select SLOs from your curriculum files to generate lesson plans.</p>
        {hasSlos && (
             <input
                type="text"
                placeholder="Search by SLO ID or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full mt-3 p-2 bg-brand-dark border border-brand-gray/30 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none text-sm"
             />
        )}
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
        {hasSlos ? (
          Object.entries(filteredUnitsByGrade).sort(([gradeA], [gradeB]) => parseInt(gradeA.replace('Grade ', '')) - parseInt(gradeB.replace('Grade ', ''))).map(([grade, units]) => {
            const allSlosInGrade = Object.values(units).flat();
            return (
              <details key={grade} open className="mb-3">
                <summary className="cursor-pointer font-semibold text-lg text-brand-primary/90 flex items-center gap-2 p-2 bg-brand-dark rounded-t-lg border-b border-brand-gray/20">
                  <ParentCheckbox slos={allSlosInGrade} onToggle={handleGradeSelection} />
                  {grade}
                </summary>
                <div className="bg-brand-dark/50 rounded-b-lg">
                  {Object.entries(units).sort(([unitNameA], [unitNameB]) => {
                      const numA = parseInt(unitNameA.match(/\d+/)?.[0] || '0');
                      const numB = parseInt(unitNameB.match(/\d+/)?.[0] || '0');
                      return numA - numB;
                  }).map(([unitName, slos]) => (
                    <details key={unitName} open className="border-t border-brand-gray/20">
                      <summary className="cursor-pointer font-medium p-3 flex items-center gap-2 text-gray-300">
                        <ParentCheckbox slos={slos} onToggle={handleUnitSelection} />
                        {unitName}
                      </summary>
                      <div className="pl-8 pr-2 pb-2">
                        {slos.map(slo => (
                          <div key={slo.uniqueId} className="flex items-start gap-3 py-2 border-t border-brand-gray/10">
                            <input
                              type="checkbox"
                              checked={selectedSloUniqueIds.includes(slo.uniqueId!)}
                              onChange={() => handleSloSelection(slo.uniqueId!)}
                              className="form-checkbox h-4 w-4 text-brand-primary bg-brand-dark border-brand-gray rounded focus:ring-brand-primary/50 mt-1"
                              aria-labelledby={`slo-text-${slo.uniqueId}`}
                            />
                            <div className="flex-1">
                              <span className="font-mono text-xs text-brand-primary/80 bg-brand-primary/10 px-1.5 py-0.5 rounded-md">{slo.SLO_ID}</span>
                              <p id={`slo-text-${slo.uniqueId}`} className="text-sm text-gray-400 mt-1">{slo.SLO_Text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )
          })
        ) : (
          <div className="text-center py-10">
            <FileIcon className="w-12 h-12 text-brand-gray mx-auto mb-3" />
            <h3 className="font-semibold text-gray-300">No SLOs Loaded</h3>
            <p className="text-sm text-brand-gray">Could not load curriculum files. Please check console for errors.</p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 mt-4 pt-4 border-t border-brand-gray/30">
        {generationProgress ? (
           <div className="w-full text-center">
              <p className="text-sm text-brand-primary mb-2">Generating... ({generationProgress.current}/{generationProgress.total})</p>
              <div className="w-full bg-brand-dark rounded-full h-2.5">
                  <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}></div>
              </div>
           </div>
        ) : (
            <button 
                onClick={onGenerate} 
                disabled={isLoading || selectedSloUniqueIds.length === 0 || !areFilesReady}
                className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-primary/90 transition-colors disabled:bg-brand-gray/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4 12.1_8H.6a.6.6 0 0 0-.6.6v3.6a.6.6 0 0 0 .6.6h3.6a.6.6 0 0 0 .6-.6v-3.6a.6.6 0 0 0-.6-.6z"/><path d="M4 18.1_8H.6a.6.6 0 0 0-.6.6v3.6a.6.6 0 0 0 .6.6h3.6a.6.6 0 0 0 .6-.6v-3.6a.6.6 0 0 0-.6-.6z"/><path d="M10 12.1_8H6.6a.6.6 0 0 0-.6.6v3.6a.6.6 0 0 0 .6.6h3.6a.6.6 0 0 0 .6-.6v-3.6a.6.6 0 0 0-.6-.6z"/><path d="M10 18.1_8H6.6a.6.6 0 0 0-.6.6v3.6a.6.6 0 0 0 .6.6h3.6a.6.6 0 0 0 .6-.6v-3.6a.6.6 0 0 0-.6-.6z"/></svg>
                Generate Lesson Plan{selectedSloUniqueIds.length > 1 ? 's' : ''} ({selectedSloUniqueIds.length})
            </button>
        )}
        {!areFilesReady && hasSlos && <p className="text-xs text-red-400 text-center mt-2">Some context PDFs are missing. Please connect the correct folder.</p>}
      </div>
    </div>
  );
};


// --- LessonPlanDisplay Component ---
interface LessonPlanDisplayProps {
  lessonPlan: LessonPlan | null;
  isLoading: boolean;
  initialMessage: string;
  onExportPdf: () => void;
  onExportDocx: () => void;
  sloId: string | null;
}

const LessonPlanDisplay: React.FC<LessonPlanDisplayProps> = ({ lessonPlan, isLoading, initialMessage, onExportPdf, onExportDocx, sloId }) => {
  if (isLoading && !lessonPlan) {
    return (
      <div className="flex-1 p-6 bg-brand-dark rounded-xl flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-brand-primary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h3 className="font-semibold text-gray-300">Generating Lesson Plan...</h3>
          <p className="text-sm text-brand-gray mt-1">AI is thinking, please wait.</p>
        </div>
      </div>
    );
  }

  if (!lessonPlan) {
    return (
      <div className="flex-1 p-6 bg-[#1e1f22] rounded-xl flex items-center justify-center">
        <div className="text-center text-brand-gray">
          <BrandIcon className="w-16 h-16 text-brand-primary/30 mx-auto mb-4" />
          <p>{initialMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-[#1e1f22] rounded-xl flex flex-col">
       <div className="flex-shrink-0 mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-200">Generated Lesson Plan</h2>
        <div className="flex gap-2">
            <button onClick={onExportPdf} className="bg-red-600/80 hover:bg-red-600 text-white font-bold py-1.5 px-3 rounded-lg text-sm transition-colors">PDF</button>
            <button onClick={onExportDocx} className="bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg text-sm transition-colors">DOCX</button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar -mr-2 pr-2">
        <div className="bg-brand-dark p-4 rounded-md">
            <h3 className="text-lg font-semibold text-brand-primary">{lessonPlan.title}</h3>
            {sloId && <p className="font-mono text-xs bg-brand-gray/10 text-brand-gray px-2 py-1 rounded-md inline-block my-2">{sloId}</p>}
            <p className="text-sm text-gray-400 mt-1 italic">{lessonPlan.summary}</p>
        </div>
        
        <div className="mt-4 space-y-4">
            <div>
                <h4 className="font-semibold text-gray-300 border-b border-brand-gray/20 pb-1 mb-2">Learning Objective</h4>
                <p className="text-sm text-gray-400">{lessonPlan.objective}</p>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300 border-b border-brand-gray/20 pb-1 mb-2">Materials</h4>
                <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                    {lessonPlan.materials.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300 border-b border-brand-gray/20 pb-1 mb-2">Activities</h4>
                {lessonPlan.activities.map((activity, index) => (
                    <div key={index} className="mt-2 p-3 bg-brand-dark/50 rounded-md">
                        <p className="font-semibold text-brand-primary/90">{activity.name} <span className="text-xs text-gray-500">({activity.duration} mins)</span></p>
                        <p className="text-sm text-gray-400 mt-1">{activity.description}</p>
                    </div>
                ))}
            </div>
             <div>
                <h4 className="font-semibold text-gray-300 border-b border-brand-gray/20 pb-1 mb-2">Assessment</h4>
                <p className="text-sm text-gray-400">{lessonPlan.assessment}</p>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300 border-b border-brand-gray/20 pb-1 mb-2">Homework</h4>
                <p className="text-sm text-gray-400">{lessonPlan.homework}</p>
            </div>
        </div>
      </div>
    </div>
  );
};


// --- App Component ---
const App: React.FC = () => {
  const [unitsByGrade, setUnitsByGrade] = useState<UnitsByGrade>({});
  const [allSlos, setAllSlos] = useState<SLO[]>([]);
  const [selectedSloUniqueIds, setSelectedSloUniqueIds] = useState<string[]>([]);
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [currentSloId, setCurrentSloId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(true);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
  const [contextPdfs, setContextPdfs] = useState<ContextPdf[]>([]);


  useEffect(() => {
    const fetchInitialSlos = async () => {
        setIsParsing(true);
        const parsedSlos = await loadInitialSlos();
        
        const slosWithUniqueIds = parsedSlos.map((slo, index) => ({
            ...slo,
            uniqueId: `${slo.SLO_ID}_${index}`
        }));
        setAllSlos(slosWithUniqueIds);

        const grouped = slosWithUniqueIds.reduce<UnitsByGrade>((acc, slo) => {
            const grade = slo.grade || 'Ungraded';
            const unit = slo.Unit_Name || 'General';
            if (!acc[grade]) acc[grade] = {};
            if (!acc[grade][unit]) acc[grade][unit] = [];
            acc[grade][unit].push(slo);
            return acc;
        }, {});
        setUnitsByGrade(grouped);
        setIsParsing(false);
    };
    fetchInitialSlos();
  }, []);
  
  useEffect(() => {
    const processDirectoryFiles = () => {
      if (directoryFiles.length === 0) {
        setContextPdfs([]);
        return;
      }
      const pdfs: ContextPdf[] = [];
      for (const file of directoryFiles) {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const gradeMatch = file.name.match(/Grade (\d+)/i);
          const unitMatch = file.name.match(/Unit (\d+)/i);
          if (gradeMatch && unitMatch) {
            const grade = `Grade ${gradeMatch[1]}`;
            const unit = unitMatch[1];
            pdfs.push({ name: file.name, grade, unit, file });
          }
        }
      }
      setContextPdfs(pdfs);
    };
    processDirectoryFiles();
  }, [directoryFiles]);
  
  const areFilesReady = useMemo(() => {
    if (selectedSloUniqueIds.length === 0) return true; // No selection, no requirement
    
    const selectedSlos = allSlos.filter(slo => selectedSloUniqueIds.includes(slo.uniqueId!));
    
    return selectedSlos.every(slo => {
      const grade = slo.grade;
      const unit = slo.Unit_Number;
      return contextPdfs.some(pdf => pdf.grade === grade && parseInt(pdf.unit, 10) === parseInt(unit, 10));
    });
  }, [selectedSloUniqueIds, allSlos, contextPdfs]);


  const fileToPart = async (file: File): Promise<Part> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
    return {
        inlineData: {
            mimeType: file.type,
            data: base64,
        },
    };
  };

  const generateAllLessonPlans = async () => {
    setIsLoading(true);
    setLessonPlan(null);
    setGenerationProgress({ current: 0, total: selectedSloUniqueIds.length });

    const selectedSlos = allSlos.filter(slo => selectedSloUniqueIds.includes(slo.uniqueId!));

    for (let i = 0; i < selectedSlos.length; i++) {
        const slo = selectedSlos[i];
        setGenerationProgress({ current: i + 1, total: selectedSlos.length });
        setCurrentSloId(slo.SLO_ID);
        try {
            const unitSlos = allSlos.filter(s => s.grade === slo.grade && s.Unit_Name === slo.Unit_Name);
            const contextPdf = contextPdfs.find(p => p.grade === slo.grade && parseInt(p.unit, 10) === parseInt(slo.Unit_Number, 10));
            
            let contextFilePart: Part | undefined;
            if (contextPdf) {
                contextFilePart = await fileToPart(contextPdf.file);
            } else {
                 console.warn(`No context PDF found for SLO ${slo.SLO_ID}. Generation may be less accurate.`);
            }

            const plan = await generateLessonPlan(slo, unitSlos, contextFilePart);
            if (i === 0) { // Display the first one immediately
                setLessonPlan(plan);
            }
            // Sequentially export
            await exportAsDocx(plan, slo.SLO_ID);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between exports
            await exportAsPdf(plan, slo.SLO_ID);
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Failed to generate or export lesson plan for ${slo.SLO_ID}:`, error);
            // Optionally, show an error to the user
            if (i === 0) {
              setLessonPlan(null); // Clear plan on error
            }
        }
    }
    
    setIsLoading(false);
    setGenerationProgress(null);
  };
  
  const handleDirectorySelected = (files: FileList) => {
    if (files.length > 0) {
      const fileArray = Array.from(files);
      const firstPath = fileArray[0].webkitRelativePath;
      if (firstPath) {
        const rootDir = firstPath.split('/')[0];
        setDirectoryName(rootDir);
      } else {
        // Fallback for browsers that don't provide webkitRelativePath
        setDirectoryName("Selected Folder");
      }
      setDirectoryFiles(fileArray);
    }
  };


  const handleExportPdf = () => {
    if (lessonPlan) {
      exportAsPdf(lessonPlan, currentSloId);
    }
  };

  const handleExportDocx = () => {
    if (lessonPlan) {
      exportAsDocx(lessonPlan, currentSloId);
    }
  };

  const displayablePdfs = useMemo(() => 
    contextPdfs.map(({ name, grade, unit }) => ({ name, grade, unit })), 
  [contextPdfs]);


  return (
    <div className="flex h-screen bg-brand-dark text-brand-light font-sans">
      {/* Sidebar for InputPanel */}
      <aside className={`bg-[#292a2d] flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-96' : 'w-0'} overflow-hidden`}>
          <div className="p-4 flex-grow flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <BrandIcon className="w-8 h-8 text-brand-primary" />
                    <h1 className="text-xl font-bold text-gray-200">Lesson Plan Generator</h1>
                </div>
                 <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-grow -mr-2 pr-2">
                <InputPanel
                    onDirectorySelected={handleDirectorySelected}
                    directoryName={directoryName}
                    contextPdfs={displayablePdfs}
                />
            </div>
          </div>
          <div className="p-4 border-t border-brand-gray/20 text-xs text-brand-gray text-center flex-shrink-0">
             <div className="flex items-center justify-center gap-2 mb-2">
                <InfoIcon className="w-4 h-4"/>
                <p>Grounds lesson plans using local PDF curriculum files.</p>
             </div>
             <span>Created by Abdul Ahad | v1.2</span>
          </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 md:p-6 gap-6 overflow-hidden">
        {!isSidebarOpen && (
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="absolute top-4 left-4 z-10 p-2 bg-[#292a2d] rounded-full"
                aria-label="Open sidebar"
            >
                <MenuIcon className="w-6 h-6" />
            </button>
        )}
        <div className="flex-1 flex gap-6 overflow-hidden">
          <SloPanel 
            unitsByGrade={unitsByGrade}
            selectedSloUniqueIds={selectedSloUniqueIds}
            setSelectedSloUniqueIds={setSelectedSloUniqueIds}
            isLoading={isLoading}
            onGenerate={generateAllLessonPlans}
            isParsing={isParsing}
            generationProgress={generationProgress}
            areFilesReady={areFilesReady}
          />
          <LessonPlanDisplay 
            lessonPlan={lessonPlan}
            isLoading={isLoading}
            initialMessage="Select one or more SLOs and click 'Generate' to create a lesson plan."
            onExportPdf={handleExportPdf}
            onExportDocx={handleExportDocx}
            sloId={currentSloId}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
