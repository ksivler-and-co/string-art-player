import React from 'react';

const SpeedControl = ({ speed, onSpeedChange }) => {
  const handleSpeedChange = (e) => {
    onSpeedChange(parseInt(e.target.value));
  };

  const displaySpeed = ((2100 - speed) / 1000).toFixed(1);

  return (
    <div className="speed-control">
      <label htmlFor="speedSlider">Speed:</label>
      <input
        type="range"
        id="speedSlider"
        className="speed-slider"
        min="100"
        max="4000"
        value={speed}
        step="100"
        onChange={handleSpeedChange}
      />
      <span className="speed-value">{displaySpeed}x</span>
    </div>
  );
};

export default SpeedControl;
