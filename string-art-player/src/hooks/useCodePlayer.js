import { useState, useEffect, useRef, useCallback } from 'react';
import googleDriveService from '../services/googleDriveService';

const useCodePlayer = () => {
  const [codes, setCodes] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [status, setStatus] = useState('Load a file to begin');
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [servicesReady, setServicesReady] = useState(false); // ADD THIS LINE
  const intervalRef = useRef(null);

  // Initialize Google Drive (New GIS way)
  useEffect(() => {
    const initGoogleServices = async () => {
      try {
        // Wait for both scripts to load
        const checkScriptsLoaded = setInterval(() => {
          if (window.gapi && window.google) {
            clearInterval(checkScriptsLoaded);
            
            // Initialize GAPI
            googleDriveService.initializeGapi().then(() => {
              // Initialize GIS
              googleDriveService.initializeGis();
              setServicesReady(true);
              setStatus('Ready - Sign in to sync with Google Drive');
            });
          }
        }, 100);
      } catch (error) {
        console.error('Failed to initialize Google services:', error);
        setStatus('Google Drive sync unavailable');
      }
    };

    initGoogleServices();
  }, []);

  // Load saved position from localStorage
  useEffect(() => {
    if (codes.length > 0) {
      const savedPosition = localStorage.getItem('codePosition');
      if (savedPosition !== null) {
        const position = Math.min(parseInt(savedPosition), codes.length - 1);
        setCurrentIndex(position);
      }
    }
  }, [codes]);

  // Save position to localStorage
  useEffect(() => {
    if (codes.length > 0) {
      localStorage.setItem('codePosition', currentIndex.toString());
    }
  }, [currentIndex, codes.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (codes.length === 0) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousCode();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCode();
          break;
        case 'Home':
          e.preventDefault();
          resetPosition();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [codes.length, currentIndex, isPlaying]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= codes.length - 1) {
            setIsPlaying(false);
            setStatus('Finished! All codes displayed.');
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, codes.length]);

  // Auto-save to Google Drive when state changes
  useEffect(() => {
    if (isGoogleSignedIn && codes.length > 0) {
      const autoSave = async () => {
        try {
          await saveToGoogleDrive();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      };

      const timeoutId = setTimeout(autoSave, 2000); // Debounce auto-save
      return () => clearTimeout(timeoutId);
    }
  }, [codes, currentIndex, speed, isGoogleSignedIn]);

  const loadCodes = useCallback((fileContent) => {
    const parsedCodes = fileContent
      .trim()
      .split(',')
      .map(code => code.trim())
      .filter(code => code);

    if (parsedCodes.length === 0) {
      alert('No codes found in the file!');
      return;
    }

    setCodes(parsedCodes);
    setCurrentIndex(0);
    setStatus(`File loaded successfully! ${parsedCodes.length} codes found.`);
  }, []);

  const togglePlay = useCallback(() => {
    if (codes.length === 0) {
      alert('Please load a codes file first!');
      return;
    }

    setIsPlaying((prev) => {
      const newState = !prev;
      setStatus(newState ? 'Playing...' : `Paused at position ${currentIndex + 1}`);
      return newState;
    });
  }, [codes.length, currentIndex]);

  const nextCode = useCallback(() => {
    if (codes.length === 0) return;
    
    setCurrentIndex((prev) => {
      if (prev < codes.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [codes.length]);

  const previousCode = useCallback(() => {
    if (codes.length === 0) return;
    
    setCurrentIndex((prev) => {
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, [codes.length]);

  const resetPosition = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setStatus('Reset to beginning');
  }, []);

  const updateSpeed = useCallback((newSpeed) => {
    setSpeed(newSpeed);
  }, []);

  // Google Drive functions
  const signInToGoogle = useCallback(async () => {
    if (!servicesReady) {
      setStatus('Google services not ready yet');
      return;
    }

    try {
      await googleDriveService.signIn();
      setIsGoogleSignedIn(true);
      
      // Get user info
      const user = await googleDriveService.getCurrentUser();
      setGoogleUser(user);
      setStatus('Signed in to Google Drive');
    } catch (error) {
      setStatus('Failed to sign in to Google Drive');
      console.error(error);
    }
  }, [servicesReady]);

  const signOutFromGoogle = useCallback(async () => {
    try {
      await googleDriveService.signOut();
      setIsGoogleSignedIn(false);
      setGoogleUser(null);
      setStatus('Signed out from Google Drive');
    } catch (error) {
      setStatus('Failed to sign out from Google Drive');
      console.error(error);
    }
  }, []);

  const saveToGoogleDrive = useCallback(async () => {
    if (!isGoogleSignedIn) {
      setStatus('Please sign in to Google Drive first');
      return;
    }

    setIsSyncing(true);
    try {
      const state = {
        codes,
        currentIndex,
        speed,
        timestamp: new Date().toISOString(),
      };

      await googleDriveService.saveState(state);
      setStatus('State saved to Google Drive');
    } catch (error) {
      setStatus('Failed to save to Google Drive');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  }, [codes, currentIndex, speed, isGoogleSignedIn]);

  const loadFromGoogleDrive = useCallback(async () => {
    if (!isGoogleSignedIn) {
      setStatus('Please sign in to Google Drive first');
      return;
    }

    setIsSyncing(true);
    try {
      const state = await googleDriveService.loadState();
      
      if (state) {
        setCodes(state.codes || []);
        setCurrentIndex(state.currentIndex || 0);
        setSpeed(state.speed || 1000);
        setStatus(`State loaded from Google Drive (saved: ${new Date(state.timestamp).toLocaleString()})`);
      } else {
        setStatus('No saved state found in Google Drive');
      }
    } catch (error) {
      setStatus('Failed to load from Google Drive');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  }, [isGoogleSignedIn]);

  const deleteFromGoogleDrive = useCallback(async () => {
    if (!isGoogleSignedIn) {
      setStatus('Please sign in to Google Drive first');
      return;
    }

    if (!window.confirm('Are you sure you want to delete the saved state from Google Drive?')) {
      return;
    }

    setIsSyncing(true);
    try {
      await googleDriveService.deleteState();
      setStatus('Saved state deleted from Google Drive');
    } catch (error) {
      setStatus('Failed to delete from Google Drive');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  }, [isGoogleSignedIn]);

  return {
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
  };
};

export default useCodePlayer;
