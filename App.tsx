
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SLO, GroupedSlos, LessonPlan } from './types';
import { generateLessonPlan } from './services/geminiService';
import { loadInitialSlos } from './services/sloService';
import InputPanel from './components/InputPanel';
import { InfoIcon, BrandIcon, MenuIcon, CloseIcon, CheckCircleIcon } from './components/icons/MiscIcons';
import { FileIcon } from './components/icons/FileIcon';
import { exportAsPdf, exportAsDocx, formatFileName } from './services/exportService';
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


// --- StatusDisplay Component ---
interface StatusDisplayProps {
  isLoading: boolean;
  isComplete: boolean;
  logMessages: string[];
  generationProgress: { current: number; total: number } | null;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ isLoading, isComplete, logMessages, generationProgress }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logMessages]);

  if (!isLoading && !isComplete) {
    return (
      <div className="flex-1 p-6 bg-[#1e1f22] rounded-xl flex items-center justify-center">
        <div className="text-center text-brand-gray">
          <BrandIcon className="w-16 h-16 text-brand-primary/30 mx-auto mb-4" />
          <p>Select SLOs and click 'Generate' to download lesson plans.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-[#1e1f22] rounded-xl flex flex-col">
      <div className="flex-shrink-0 mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-200">
          {isComplete ? 'Generation Complete' : 'Generation in Progress'}
        </h2>
      </div>

      {isLoading && generationProgress && (
        <div className="w-full text-center flex-shrink-0 mb-4">
          <p className="text-sm text-brand-primary mb-2">Processing... ({generationProgress.current}/{generationProgress.total})</p>
          <div className="w-full bg-brand-dark rounded-full h-2.5">
            <div
              className="bg-brand-primary h-2.5 rounded-full"
              style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%`, transition: 'width 0.3s ease-in-out' }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto custom-scrollbar bg-brand-dark p-4 rounded-md min-h-0">
        {logMessages.length > 0 ? (
          logMessages.map((msg, index) => (
            <div key={index} className="flex items-start text-sm font-mono">
              <span className="text-brand-gray/80 mr-2">{`[${new Date().toLocaleTimeString()}]`}</span>
              <p
                className={`flex-1 ${
                  msg.startsWith('ERROR') ? 'text-red-400' : msg.startsWith('Successfully') ? 'text-green-400' : 'text-gray-400'
                } whitespace-pre-wrap break-words`}
              >
                {msg}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-gray">Waiting to start generation...</p>
        )}
        <div ref={logsEndRef} />
      </div>

      {isComplete && (
        <div className="mt-4 text-center p-4 bg-green-900/50 rounded-md border border-green-500/50 flex-shrink-0">
            <div className="flex items-center justify-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-300" />
                <p className="font-semibold text-green-300">Success!</p>
            </div>
          <p className="text-sm text-gray-300 mt-1">All generated files have been sent to your browser's default download folder.</p>
        </div>
      )}
    </div>
  );
};


// --- App Component ---
const App: React.FC = () => {
  const [unitsByGrade, setUnitsByGrade] = useState<UnitsByGrade>({});
  const [allSlos, setAllSlos] = useState<SLO[]>([]);
  const [selectedSloUniqueIds, setSelectedSloUniqueIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(true);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState<boolean>(false);

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
    setIsComplete(false);
    setLogMessages(['Starting lesson plan generation...']);
    setGenerationProgress({ current: 0, total: selectedSloUniqueIds.length });

    const selectedSlos = allSlos.filter(slo => selectedSloUniqueIds.includes(slo.uniqueId!));

    for (let i = 0; i < selectedSlos.length; i++) {
        const slo = selectedSlos[i];
        setGenerationProgress({ current: i + 1, total: selectedSlos.length });
        setLogMessages(prev => [...prev, `\nProcessing SLO: ${slo.SLO_ID}`]);

        try {
            const unitSlos = allSlos.filter(s => s.grade === slo.grade && s.Unit_Name === slo.Unit_Name);
            const contextPdf = contextPdfs.find(p => p.grade === slo.grade && parseInt(p.unit, 10) === parseInt(slo.Unit_Number, 10));
            
            let contextFilePart: Part | undefined;
            if (contextPdf) {
                setLogMessages(prev => [...prev, `Found context file: ${contextPdf.name}`]);
                contextFilePart = await fileToPart(contextPdf.file);
            } else {
                 const warningMsg = `No context PDF found for SLO ${slo.SLO_ID}. Generation may be less accurate.`;
                 console.warn(warningMsg);
                 setLogMessages(prev => [...prev, `WARN: ${warningMsg}`]);
            }
            
            setLogMessages(prev => [...prev, `Generating lesson plan content...`]);
            const plan = await generateLessonPlan(slo, unitSlos, contextFilePart);
            setLogMessages(prev => [...prev, `Content received. Title: "${plan.title}"`]);

            // Sequentially export
            const docxFileName = formatFileName(plan.title, slo.SLO_ID);
            setLogMessages(prev => [...prev, `Exporting ${docxFileName}.docx...`]);
            await exportAsDocx(plan, slo.SLO_ID);
            await new Promise(resolve => setTimeout(resolve, 250));
            
            const pdfFileName = formatFileName(plan.title, slo.SLO_ID);
            setLogMessages(prev => [...prev, `Exporting ${pdfFileName}.pdf...`]);
            await exportAsPdf(plan, slo.SLO_ID);
            await new Promise(resolve => setTimeout(resolve, 250));
            
            setLogMessages(prev => [...prev, `Successfully processed ${slo.SLO_ID}.`]);

        } catch (error) {
            const errorMsg = `Failed for ${slo.SLO_ID}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            setLogMessages(prev => [...prev, `ERROR: ${errorMsg}`]);
        }
    }
    
    setIsLoading(false);
    setGenerationProgress(null);
    setIsComplete(true);
    setLogMessages(prev => [...prev, `\nGeneration finished.`]);
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
          <StatusDisplay
            isLoading={isLoading}
            isComplete={isComplete}
            logMessages={logMessages}
            generationProgress={generationProgress}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
