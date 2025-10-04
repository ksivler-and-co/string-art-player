import React from 'react';

const CodeDisplay = ({ code }) => {
  return (
    <div className="code-display">
      {code || 'Ready'}
    </div>
  );
};

export default CodeDisplay;
