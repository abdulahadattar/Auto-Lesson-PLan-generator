
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ManagedFile } from '../types';
import { CheckCircleIcon, ErrorIcon } from './icons/MiscIcons';

interface InputPanelProps {
  files: ManagedFile[];
  onFilesAccepted: (acceptedFiles: File[]) => void;
  removeFile: (fileToRemove: ManagedFile) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({ files, onFilesAccepted, removeFile }) => {

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const allowedTypes = [
        'application/pdf', 
        'text/plain',
        'application/json',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const filteredFiles = acceptedFiles.filter(file => 
      allowedTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.json')
    );
    onFilesAccepted(filteredFiles);
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  });

  const StatusIndicator: React.FC<{ status: ManagedFile['status'] }> = ({ status }) => {
    switch (status) {
      case 'ready':
        return (
            <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-400">Ready</span>
            </div>
        );
      case 'error':
        return (
            <div className="flex items-center gap-2">
                <ErrorIcon className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-400">Error</span>
            </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="bg-[#1e1f22] p-0 rounded-xl flex flex-col gap-6">
      <div>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 ${isDragActive ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-gray/50 hover:border-brand-primary/80'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <UploadIcon className="w-10 h-10 text-brand-gray mb-3" />
            {isDragActive ? (
              <p className="text-brand-primary">Drop the files here...</p>
            ) : (
              <p className="text-brand-gray">Drag & drop files here. <span className="font-semibold text-gray-400">SLOs are parsed from .txt or .json files.</span> Other files (.pdf, .docx) provide context.</p>
            )}
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-gray-300 border-b border-brand-gray/30 pb-2">Curriculum Documents</h3>
            {files.map((managedFile, index) => (
                <div key={index} className="flex items-center justify-between bg-brand-dark p-2.5 rounded-md" title={managedFile.error}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <FileIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm text-gray-300 truncate">{managedFile.file.name}</span>
                        <StatusIndicator status={managedFile.status} />
                    </div>
                </div>
                <button
                    onClick={() => removeFile(managedFile)}
                    className="p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                    aria-label="Remove file"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default InputPanel;
