const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ');

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER_NAME = 'CodeDisplayApp';
const STATE_FILE_NAME = 'app-state.json';

// Token storage keys
const TOKEN_STORAGE_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';
const USER_INFO_KEY = 'google_user_info';

class GoogleDriveService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.gapiInited = false;
    this.gisInited = false;
  }

  // Initialize GAPI client
  async initializeGapi() {
    return new Promise((resolve) => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        this.gapiInited = true;
        
        // Try to restore token from localStorage
        this.restoreToken();
        
        resolve(true);
      });
    });
  }

  // Initialize GIS (Google Identity Services)
  initializeGis(callback) {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error !== undefined) {
          throw response;
        }
        this.accessToken = response.access_token;
        
        // Calculate expiry time (tokens typically last 3600 seconds = 1 hour)
        const expiresIn = response.expires_in || 3600;
        this.tokenExpiry = Date.now() + (expiresIn * 1000);
        
        // Save token to localStorage
        this.saveToken();
        
        if (callback) callback(response);
      },
    });
    this.gisInited = true;
  }

  // Save token to localStorage
  saveToken() {
    if (this.accessToken && this.tokenExpiry) {
      localStorage.setItem(TOKEN_STORAGE_KEY, this.accessToken);
      localStorage.setItem(TOKEN_EXPIRY_KEY, this.tokenExpiry.toString());
    }
  }

  // Restore token from localStorage
  restoreToken() {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    if (storedToken && storedExpiry) {
      const expiry = parseInt(storedExpiry);
      
      // Check if token is still valid (with 5 minute buffer)
      if (Date.now() < expiry - (5 * 60 * 1000)) {
        this.accessToken = storedToken;
        this.tokenExpiry = expiry;
        
        // Set token for gapi client
        if (this.gapiInited) {
          window.gapi.client.setToken({ access_token: this.accessToken });
        }
        
        return true;
      } else {
        // Token expired, clear it
        this.clearToken();
      }
    }
    
    return false;
  }

  // Clear stored token
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  }

  // Check if user is signed in
  isSignedIn() {
    // Check if we have a token and it's not expired
    if (this.accessToken && this.tokenExpiry) {
      if (Date.now() < this.tokenExpiry - (5 * 60 * 1000)) {
        return true;
      } else {
        // Token expired
        this.clearToken();
        return false;
      }
    }
    return false;
  }

  // Sign in - Request access token
  async signIn() {
    return new Promise((resolve, reject) => {
      if (!this.gisInited || !this.gapiInited) {
        reject(new Error('Services not initialized'));
        return;
      }

      try {
        // Set callback for this specific request
        this.tokenClient.callback = async (response) => {
          if (response.error !== undefined) {
            reject(response);
            return;
          }
          this.accessToken = response.access_token;
          
          // Calculate expiry time
          const expiresIn = response.expires_in || 3600;
          this.tokenExpiry = Date.now() + (expiresIn * 1000);
          
          // Save token
          this.saveToken();
          
          // Set access token for gapi client
          window.gapi.client.setToken({ access_token: this.accessToken });
          
          resolve(response);
        };

        // Request token with prompt
        if (this.accessToken === null) {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          this.tokenClient.requestAccessToken({ prompt: '' });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // Sign out
  async signOut() {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Access token revoked');
      });
      this.clearToken();
      window.gapi.client.setToken(null);
    }
  }

  // Get current user info (with caching)
  async getCurrentUser() {
    if (!this.accessToken) return null;

    // Try to get from cache first
    const cachedUser = localStorage.getItem(USER_INFO_KEY);
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {
        // Invalid cache, continue to fetch
      }
    }

    try {
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error(`UserInfo request failed: ${userInfoResponse.status}`);
      }

      const userInfo = await userInfoResponse.json();

      const user = {
        email: userInfo.email,
        name: userInfo.name,
        imageUrl: userInfo.picture,
        id: userInfo.id,
      };

      // Cache user info
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  // Get cached user info without making API call
  getCachedUser() {
    const cachedUser = localStorage.getItem(USER_INFO_KEY);
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Create or get app folder
  async getOrCreateAppFolder() {
    try {
      // Search for existing folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
      }

      // Create folder if it doesn't exist
      const folderMetadata = {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folder = await window.gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      return folder.result.id;
    } catch (error) {
      console.error('Error creating/getting folder:', error);
      throw error;
    }
  }

  // Save state to Google Drive
async saveState(state) {
  try {
    const folderId = await this.getOrCreateAppFolder();
    const stateJson = JSON.stringify(state, null, 2);

    // Check if state file already exists
    const existingFiles = await window.gapi.client.drive.files.list({
      q: `name='${STATE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    const boundary = 'foo_bar_baz';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    if (existingFiles.result.files && existingFiles.result.files.length > 0) {
      // Update existing file - DON'T include parents in metadata
      const fileId = existingFiles.result.files[0].id;
      
      const metadata = {
        name: STATE_FILE_NAME,
        mimeType: 'application/json',
        // DO NOT include parents field here
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        stateJson +
        closeDelim;

      // Use the standard drive API endpoint (not /upload)
      const request = window.gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { 
          uploadType: 'multipart',
          // Don't modify parents on update
        },
        headers: {
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartRequestBody,
      });

      const response = await request;
      return response.result;
    } else {
      // Create new file - parents ARE allowed on creation
      const metadata = {
        name: STATE_FILE_NAME,
        mimeType: 'application/json',
        parents: [folderId], // Parents are allowed on CREATE
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        stateJson +
        closeDelim;

      const request = window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartRequestBody,
      });

      const response = await request;
      return response.result;
    }
  } catch (error) {
    console.error('Error saving state:', error);
    throw error;
  }
}

  // Load state from Google Drive
  async loadState() {
    try {
      const folderId = await this.getOrCreateAppFolder();

      // Find the state file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${STATE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (!response.result.files || response.result.files.length === 0) {
        return null;
      }

      const fileId = response.result.files[0].id;

      // Get file content
      const fileContent = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      return JSON.parse(fileContent.body);
    } catch (error) {
      console.error('Error loading state:', error);
      throw error;
    }
  }

  // Delete saved state
  async deleteState() {
    try {
      const folderId = await this.getOrCreateAppFolder();

      const response = await window.gapi.client.drive.files.list({
        q: `name='${STATE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (response.result.files && response.result.files.length > 0) {
        const fileId = response.result.files[0].id;
        await window.gapi.client.drive.files.delete({ fileId });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting state:', error);
      throw error;
    }
  }
}

export default new GoogleDriveService();
