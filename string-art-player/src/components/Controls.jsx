import React from 'react';

const Controls = ({ 
  isPlaying, 
  onTogglePlay, 
  onPrevious, 
  onNext, 
  onReset,
  canGoPrevious,
  canGoNext
}) => {
  return (
    <div className="controls">
      <button 
        className={`control-btn ${isPlaying ? 'pause' : ''}`}
        onClick={onTogglePlay}
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      <button 
        className="control-btn" 
        onClick={onPrevious}
        disabled={!canGoPrevious}
      >
        ⏮️ Previous
      </button>
      <button 
        className="control-btn" 
        onClick={onNext}
        disabled={!canGoNext}
      >
        ⏭️ Next
      </button>
      <button 
        className="control-btn reset" 
        onClick={onReset}
      >
        🔄 Reset
      </button>
    </div>
  );
};

export default Controls;
