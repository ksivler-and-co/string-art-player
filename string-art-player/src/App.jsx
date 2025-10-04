import React from 'react';
import FileUploader from './components/FileUploader';
import CodeDisplay from './components/CodeDisplay';
import ProgressBar from './components/ProgressBar';
import Controls from './components/Controls';
import SpeedControl from './components/SpeedControl';
import GoogleDriveSync from './components/GoogleDriveSync';
import useCodePlayer from './hooks/useCodePlayer';
import './App.css';

function App() {
  const {
    codes,
    currentIndex,
    isPlaying,
    speed,
    status,
    isGoogleSignedIn,
    googleUser,
    isSyncing,
    servicesReady,
    loadCodes,
    togglePlay,
    nextCode,
    previousCode,
    resetPosition,
    updateSpeed,
    signInToGoogle,
    signOutFromGoogle,
    saveToGoogleDrive,
    loadFromGoogleDrive,
    deleteFromGoogleDrive,
  } = useCodePlayer();

  return (
    <div className="container">
      <h1 className="title">🎨 String Art Player</h1>
      
      {servicesReady && (
        <GoogleDriveSync
          isSignedIn={isGoogleSignedIn}
          user={googleUser}
          isSyncing={isSyncing}
          onSignIn={signInToGoogle}
          onSignOut={signOutFromGoogle}
          onSave={saveToGoogleDrive}
          onLoad={loadFromGoogleDrive}
          onDelete={deleteFromGoogleDrive}
        />
      )}

      {codes.length === 0 ? (
        <FileUploader onLoad={loadCodes} />
      ) : (
        <div className="display-section">
          <CodeDisplay code={codes[currentIndex]} />
          
          <ProgressBar 
            current={currentIndex + 1} 
            total={codes.length} 
          />
          
          <Controls
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onPrevious={previousCode}
            onNext={nextCode}
            onReset={resetPosition}
            canGoPrevious={currentIndex > 0}
            canGoNext={currentIndex < codes.length - 1}
          />
          
          <SpeedControl
            speed={speed}
            onSpeedChange={updateSpeed}
          />
          
          <div className="status">{status}</div>
        </div>
      )}
    </div>
  );
}

export default App;
