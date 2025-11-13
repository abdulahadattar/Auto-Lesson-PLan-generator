
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SLO, GroupedSlos, LessonPlan, ManagedFile } from './types';
import { generateLessonPlan } from './services/geminiService';
import { parseSloFiles } from './services/sloService';
import InputPanel from './components/InputPanel';
import { InfoIcon, BrandIcon, MenuIcon, CloseIcon } from './components/icons/MiscIcons';
import { exportAsPdf, exportAsDocx } from './services/exportService';

interface UnitsByGrade {
  [grade: string]: GroupedSlos;
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
        .reduce((acc, { unitName, slos }) => {
          acc[unitName] = slos;
          return acc;
        }, {} as GroupedSlos);
    };

    return Object.entries(unitsByGrade)
      .map(([grade, units]) => ({ grade, units: filterGrade(units) }))
      .filter(({ units }) => Object.keys(units).length > 0)
      .reduce((acc, { grade, units }) => {
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
    const checkboxRef = useRef<HTMLInputElement>(null);
    const sloUniqueIds = useMemo(() => slos.map(s => s.uniqueId!), [slos]);
    const selectedCount = useMemo(() => selectedSloUniqueIds.filter(id => sloUniqueIds.includes(id)).length, [selectedSloUniqueIds, sloUniqueIds]);

    useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = selectedCount > 0 && selectedCount < sloUniqueIds.length;
      }
    }, [selectedCount, sloUniqueIds.length]);

    return (
      <input
        ref={checkboxRef}
        type="checkbox"
        className="form-checkbox h-5 w-5 bg-brand-gray/50 border-brand-gray rounded text-brand-primary focus:ring-brand-primary flex-shrink-0"
        checked={selectedCount === sloUniqueIds.length && sloUniqueIds.length > 0}
        onChange={() => onToggle(slos)}
        disabled={isLoading || slos.length === 0}
      />
    );
  };

  const renderSloTree = (title: string, units: GroupedSlos, allSlosInGrade: SLO[]) => {
    if (Object.keys(units).length === 0) return null;
    return (
      <details className="group" open>
        <summary className="flex items-center space-x-3 p-2 rounded-md cursor-pointer hover:bg-brand-gray/20 transition-colors font-semibold">
          <ParentCheckbox slos={allSlosInGrade} onToggle={handleGradeSelection} />
          <span className="text-white select-none">{title}</span>
        </summary>
        <div className="pl-4 border-l border-brand-gray/50 ml-2.5">
          {Object.entries(units).sort(([, slosA], [, slosB]) => {
            if (!slosA?.[0] || !slosB?.[0]) return 0;
            return parseInt(slosA[0].Unit_Number, 10) - parseInt(slosB[0].Unit_Number, 10);
          }).map(([unitName, slos]) => (
            <details key={unitName} className="group/unit mt-1" open>
              <summary className="flex items-center space-x-3 p-1.5 rounded-md cursor-pointer hover:bg-brand-gray/20 transition-colors">
                <ParentCheckbox slos={slos} onToggle={handleUnitSelection} />
                <span className="text-gray-300 select-none">{unitName} <span className="text-xs text-gray-500">({slos.length} SLOs)</span></span>
              </summary>
              <div className="pl-6 border-l border-brand-gray/30 ml-2.5 space-y-1 py-1">
                {slos.sort((a, b) => a.SLO_ID.localeCompare(b.SLO_ID)).map(slo => (
                  <label key={slo.uniqueId!} className="flex items-start space-x-3 p-1.5 rounded-md cursor-pointer hover:bg-brand-gray/20 transition-colors">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 bg-brand-gray/50 border-brand-gray rounded text-brand-primary focus:ring-brand-primary mt-0.5 flex-shrink-0"
                      checked={selectedSloUniqueIds.includes(slo.uniqueId!)}
                      onChange={() => handleSloSelection(slo.uniqueId!)}
                      disabled={isLoading}
                    />
                    <span className="text-gray-400 text-sm select-none">
                      <b className="text-gray-500">{slo.SLO_ID}:</b> {slo.SLO_Text}
                    </span>
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
      </details>
    );
  };
  
  const noSlosAvailable = Object.keys(unitsByGrade).length === 0;
  const noFilteredResults = !noSlosAvailable && Object.keys(filteredUnitsByGrade).length === 0;


  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-white mb-2">2. Select SLOs to Generate</h2>
      <div className="relative mb-3 flex-shrink-0">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input
          type="text"
          placeholder="Search by SLO ID or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-brand-dark border border-brand-gray/50 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
          disabled={isLoading || isParsing || noSlosAvailable}
          aria-label="Search SLOs"
        />
      </div>
      <div className="bg-brand-dark border border-brand-gray/50 rounded-md p-3 flex-grow overflow-hidden mb-4">
        <div className="h-full overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {isParsing ? (
             <div className="flex items-center justify-center h-full text-brand-gray">
                <p>Loading SLOs...</p>
             </div>
          ) : noSlosAvailable ? (
             <div className="flex items-center justify-center h-full text-brand-gray text-center px-4">
               <p>No SLOs found.<br/>Please upload one or more curriculum files to begin.</p>
             </div>
          ) : noFilteredResults ? (
            <div className="flex items-center justify-center h-full text-brand-gray text-center px-4">
              <p>No SLOs match your search.</p>
            </div>
          ) : (
            <>
              {Object.entries(filteredUnitsByGrade)
                .sort(([gradeA], [gradeB]) => gradeA.localeCompare(gradeB, undefined, { numeric: true }))
                .map(([grade, units]) => {
                  const allOriginalSlosForGrade = Object.values(unitsByGrade[grade] || {}).flat();
                  return (
                    <React.Fragment key={grade}>
                      {renderSloTree(grade, units, allOriginalSlosForGrade)}
                    </React.Fragment>
                  );
                })}
            </>
          )}
        </div>
      </div>
       <button
        onClick={onGenerate}
        disabled={isLoading || selectedSloUniqueIds.length === 0 || !areFilesReady}
        className="w-full bg-brand-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-primary/90 transition-colors disabled:bg-brand-gray/50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {generationProgress ? `Generating ${generationProgress.current} of ${generationProgress.total}...` : 'Generating...'}
          </>
        ) : (
          `Generate Lesson Plan${selectedSloUniqueIds.length > 1 ? 's' : ''}`
        )}
      </button>
      <p className="text-xs text-center text-gray-500 mt-2">
        { selectedSloUniqueIds.length === 0 ? "Please select one or more SLOs to generate a plan." : `${selectedSloUniqueIds.length} SLO${selectedSloUniqueIds.length > 1 ? 's' : ''} selected. Ready to generate!` }
      </p>
    </div>
  );
};

// --- App Component ---
const App: React.FC = () => {
    const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
    const [allSlos, setAllSlos] = useState<SLO[]>([]);
    const [unitsByGrade, setUnitsByGrade] = useState<UnitsByGrade>({});
    const [selectedSloUniqueIds, setSelectedSloUniqueIds] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
    
    // Load default files
    useEffect(() => {
        const loadDefaultFiles = async () => {
            setIsParsing(true);
            setError(null);
            try {
                const defaultFilePaths = [
                    'SLOschema/Grade_9.json', 'SLOschema/Grade_10.json',
                    'SLOschema/Grade_11.json', 'SLOschema/Grade_12.json'
                ];
                
                const filePromises = defaultFilePaths.map(async (path) => {
                    const response = await fetch(path);
                    if (!response.ok) throw new Error(`Failed to fetch ${path}`);
                    const text = await response.text();
                    const fileName = path.split('/').pop()!;
                    const fileType = path.endsWith('.json') ? 'application/json' : 'text/plain';
                    return new File([text], fileName, { type: fileType });
                });

                const loadedFiles = await Promise.all(filePromises);
                
                const sloFiles = loadedFiles.filter(f => f.name.endsWith('.json') || f.name.endsWith('.txt'));
                const parsedSlos = await parseSloFiles(sloFiles);
                const slosWithUniqueIds = parsedSlos.map((slo, index) => ({
                    ...slo, uniqueId: `${slo.grade}-${slo.SLO_ID}-${index}`,
                }));
                setAllSlos(slosWithUniqueIds);
                
                setManagedFiles(loadedFiles.map(file => ({ file, status: 'ready' })));

            } catch (err) {
                console.error("Error loading default files:", err);
                setError("Could not load default curriculum files. You can still upload files manually.");
            } finally {
                setIsParsing(false);
            }
        };

        loadDefaultFiles();
    }, []);

    useEffect(() => {
        const newUnitsByGrade: UnitsByGrade = {};
        allSlos.forEach(slo => {
            if (!slo.grade) return;
            if (!newUnitsByGrade[slo.grade]) newUnitsByGrade[slo.grade] = {};
            const gradeUnits = newUnitsByGrade[slo.grade];
            if (!gradeUnits[slo.Unit_Name]) gradeUnits[slo.Unit_Name] = [];
            gradeUnits[slo.Unit_Name].push(slo);
        });
        setUnitsByGrade(newUnitsByGrade);
        setSelectedSloUniqueIds([]);
    }, [allSlos]);
    
    const areFilesReady = useMemo(() => {
        return managedFiles.length > 0 && managedFiles.every(f => f.status === 'ready');
    }, [managedFiles]);

    const handleFilesAccepted = async (acceptedFiles: File[]) => {
        const newManagedFiles = acceptedFiles.map(file => ({ file, status: 'ready' as const }));
        setManagedFiles(prev => [...prev, ...newManagedFiles]);
        
        // Also parse any new SLO files
        const newSloFiles = acceptedFiles.filter(f => f.name.endsWith('.json') || f.name.endsWith('.txt'));
        if (newSloFiles.length > 0) {
            const parsed = await parseSloFiles(newSloFiles);
            const slosWithIds = parsed.map((slo, index) => ({
                 ...slo, uniqueId: `${slo.grade}-${slo.SLO_ID}-${Date.now()}-${index}`
            }));
            setAllSlos(prev => [...prev, ...slosWithIds]);
        }
    };

    const handleRemoveFile = (fileToRemove: ManagedFile) => {
        setManagedFiles(prev => prev.filter(f => f.file.name !== fileToRemove.file.name));
        
        // If it was an SLO file, we might need to remove its SLOs
        if(fileToRemove.file.name.endsWith('.json') || fileToRemove.file.name.endsWith('.txt')){
            // Simple approach: re-parse all remaining files.
            const remainingSloFiles = managedFiles
                .filter(f => f.file.name !== fileToRemove.file.name && (f.file.name.endsWith('.json') || f.file.name.endsWith('.txt')))
                .map(f => f.file);
            
            parseSloFiles(remainingSloFiles).then(parsed => {
                 const slosWithIds = parsed.map((slo, index) => ({
                    ...slo, uniqueId: `${slo.grade}-${slo.SLO_ID}-${index}`
                }));
                setAllSlos(slosWithIds);
            });
        }
    };


    const handleGenerate = useCallback(async () => {
        if (selectedSloUniqueIds.length === 0) {
            setError("Please select SLOs to generate a lesson plan.");
            return;
        }

        const slosToGenerate = allSlos.filter(slo => selectedSloUniqueIds.includes(slo.uniqueId!));
        if (slosToGenerate.length === 0) {
            setError("Selected SLOs not found.");
            return;
        }

        setIsGenerating(true);
        setError(null);

        const total = slosToGenerate.length;
        setGenerationProgress({ current: 0, total });

        try {
            for (const [index, slo] of slosToGenerate.entries()) {
                setGenerationProgress({ current: index + 1, total });
                const unitSlos = allSlos.filter(s => s.Unit_Name === slo.Unit_Name && s.grade === slo.grade);
                const plan = await generateLessonPlan(slo, unitSlos);
                
                await exportAsPdf(plan, slo?.SLO_ID);
                await new Promise(resolve => setTimeout(resolve, 250)); // Delay to help browser manage downloads
                await exportAsDocx(plan, slo?.SLO_ID);
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            setSelectedSloUniqueIds([]); // Reset selection on success
        } catch (err) {
            console.error("Error generating lesson plan:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred while generating the lesson plan.");
        } finally {
            setIsGenerating(false);
            setGenerationProgress(null);
        }
    }, [selectedSloUniqueIds, allSlos, setSelectedSloUniqueIds]);
    
    return (
        <div className="bg-[#1e1f22] min-h-screen text-gray-300 font-sans">
            <div className="flex h-screen overflow-hidden">
                <aside className={`bg-[#282a2e] shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-full max-w-md' : 'w-0'} flex-shrink-0`}>
                    <div className={`p-6 flex flex-col h-full overflow-hidden ${!isSidebarOpen && 'invisible opacity-0'}`}>
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h2 className="text-lg font-semibold text-white">1. Upload Curriculum Files</h2>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-1 rounded-full text-gray-400 hover:bg-brand-gray/20 hover:text-white transition-colors" aria-label="Close sidebar">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-grow custom-scrollbar pr-2 -mr-2">
                            <InputPanel files={managedFiles} onFilesAccepted={handleFilesAccepted} removeFile={handleRemoveFile} />
                            {areFilesReady && (
                                <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-200 text-sm flex items-start gap-3">
                                    <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                                    <span>
                                        <strong>Ready:</strong> All files are processed. Select a Student Learning Outcome (SLO) to generate your lesson plan.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-w-0">
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col">
                        <header className="text-center mb-6 flex-shrink-0 relative">
                            {!isSidebarOpen && (
                                <button onClick={() => setIsSidebarOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 p-2 rounded-md text-gray-400 hover:bg-brand-gray/20 hover:text-white transition-colors" aria-label="Open sidebar">
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                            )}
                            <div className="flex justify-center items-center gap-3">
                                <BrandIcon className="w-10 h-10 text-brand-primary" />
                                <h1 className="text-4xl font-bold text-white tracking-tight">Lesson Plan Generator</h1>
                            </div>
                            <p className="mt-3 text-lg text-brand-gray max-w-3xl mx-auto">Upload your curriculum, select a Student Learning Outcome (SLO), and let AI craft a detailed lesson plan grounded in your documents.</p>
                        </header>

                        {error && (
                            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-6 max-w-4xl mx-auto flex-shrink-0" role="alert">
                                <strong className="font-bold">Error: </strong>
                                <span className="block sm:inline">{error}</span>
                                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close error">
                                    <span className="text-2xl font-light">×</span>
                                </button>
                            </div>
                        )}

                        <div className="flex-1 min-h-0 bg-[#282a2e] p-6 rounded-xl shadow-lg">
                            <SloPanel 
                                unitsByGrade={unitsByGrade} 
                                selectedSloUniqueIds={selectedSloUniqueIds}
                                setSelectedSloUniqueIds={setSelectedSloUniqueIds}
                                isLoading={isGenerating}
                                onGenerate={handleGenerate}
                                isParsing={isParsing}
                                generationProgress={generationProgress}
                                areFilesReady={areFilesReady}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default App;
