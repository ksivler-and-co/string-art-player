import React, { useRef } from 'react';

const FileUploader = ({ onLoad }) => {
  const fileInputRef = useRef(null);

  const handleLoadFile = () => {
    const file = fileInputRef.current?.files[0];
    
    if (!file) {
      alert('Please select a file first!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onLoad(e.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="file-input-section">
      <div className="file-input">
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".txt" 
        />
      </div>
      <button className="load-btn" onClick={handleLoadFile}>
        Load Codes File
      </button>
    </div>
  );
};

export default FileUploader;
