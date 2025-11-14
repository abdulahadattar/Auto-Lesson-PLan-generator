
import React, { useRef } from 'react';
import { FileIcon } from './icons/FileIcon';

// Fix: Add React module declaration to support non-standard directory and webkitdirectory attributes.
declare module 'react' {
    interface InputHTMLAttributes<T> {
      webkitdirectory?: string;
      directory?: string;
    }
}

interface ContextPdfForDisplay {
    name: string;
    grade: string;
    unit: string;
}

interface InputPanelProps {
  onDirectorySelected: (files: FileList) => void;
  directoryName: string | null;
  contextPdfs: ContextPdfForDisplay[];
}

const InputPanel: React.FC<InputPanelProps> = ({ 
    onDirectorySelected,
    directoryName,
    contextPdfs
}) => {
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const handleDirectoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
          onDirectorySelected(event.target.files);
      }
  };

  const handleConnectClick = () => {
      directoryInputRef.current?.click();
  };

  return (
    <div className="bg-[#1e1f22] p-0 rounded-xl flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-gray-300 border-b border-brand-gray/30 pb-2 mb-3">Local Context Folder</h3>
        <div className="p-4 bg-brand-dark rounded-lg">
            <p className="text-sm text-brand-gray mb-3">Connect a local folder with your PDF curriculum. The app will automatically match files to SLOs by grade and unit from the filename.</p>
            <input
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                ref={directoryInputRef}
                onChange={handleDirectoryChange}
                style={{ display: 'none' }}
             />
            <button
                onClick={handleConnectClick}
                className="w-full bg-brand-primary/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-primary transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              {directoryName ? 'Change Folder' : 'Connect Folder'}
            </button>
            {directoryName && (
                <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">Connected: <span className="font-mono bg-[#1e1f22] p-1 rounded">{directoryName}</span></p>
                    <div className="mt-2 max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                        {contextPdfs.length > 0 ? (
                            contextPdfs.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(pdf => (
                                <div key={pdf.name} className="flex items-center gap-2 p-1.5 bg-brand-gray/10 rounded">
                                    <FileIcon className="w-4 h-4 text-brand-primary flex-shrink-0" />
                                    <span className="text-xs text-gray-300 truncate flex-grow" title={pdf.name}>{pdf.name}</span>
                                    <span className="text-xs font-medium text-blue-300 bg-blue-900/50 px-1.5 py-0.5 rounded-full flex-shrink-0">{pdf.grade}</span>
                                    <span className="text-xs font-medium text-green-300 bg-green-900/50 px-1.5 py-0.5 rounded-full flex-shrink-0">Unit {pdf.unit}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-center text-brand-gray p-4">No valid PDF files found. Ensure filenames contain 'Grade [Number]' and 'Unit [Number]'.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default InputPanel;
