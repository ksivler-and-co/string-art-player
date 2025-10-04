import React from 'react';

const GoogleDriveSync = ({
  isSignedIn,
  user,
  isSyncing,
  onSignIn,
  onSignOut,
  onSave,
  onLoad,
  onDelete,
}) => {
  return (
    <div className="google-drive-section">
      <h3 className="sync-title">☁️ Google Drive Sync</h3>
      
      {!isSignedIn ? (
        <div className="sync-signin">
          <p className="sync-info">Sign in to save and load your progress across devices</p>
          <button className="sync-btn signin" onClick={onSignIn}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="sync-controls">
          <div className="user-info">
            {user && (
              <>
                {user.imageUrl && (
                  <img 
                    src={user.imageUrl} 
                    alt={user.name} 
                    className="user-avatar"
                  />
                )}
                <div className="user-details">
                  <strong>{user.name}</strong>
                  <span className="user-email">{user.email}</span>
                </div>
              </>
            )}
            <button className="sync-btn signout" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
          
          <div className="sync-actions">
            <button 
              className="sync-btn save" 
              onClick={onSave}
              disabled={isSyncing}
            >
              {isSyncing ? '⏳ Syncing...' : '💾 Save to Drive'}
            </button>
            <button 
              className="sync-btn load" 
              onClick={onLoad}
              disabled={isSyncing}
            >
              {isSyncing ? '⏳ Loading...' : '📥 Load from Drive'}
            </button>
            <button 
              className="sync-btn delete" 
              onClick={onDelete}
              disabled={isSyncing}
            >
              🗑️ Delete Saved
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveSync;
