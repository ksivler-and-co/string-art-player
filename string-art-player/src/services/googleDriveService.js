const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER_NAME = 'CodeDisplayApp';
const STATE_FILE_NAME = 'app-state.json';

class GoogleDriveService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
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
        if (callback) callback(response);
      },
    });
    this.gisInited = true;
  }

  // Check if user is signed in
  isSignedIn() {
    return this.accessToken !== null;
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
      this.accessToken = null;
      window.gapi.client.setToken(null);
    }
  }

  // Get current user info (using tokeninfo endpoint)
  async getCurrentUser() {
    if (!this.accessToken) return null;

    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${this.accessToken}`
      );
      const data = await response.json();
      
      // Get additional user info
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      const userInfo = await userInfoResponse.json();

      return {
        email: userInfo.email,
        name: userInfo.name,
        imageUrl: userInfo.picture,
      };
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
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

      const metadata = {
        name: STATE_FILE_NAME,
        mimeType: 'application/json',
        parents: [folderId],
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        stateJson +
        closeDelim;

      let request;
      if (existingFiles.result.files && existingFiles.result.files.length > 0) {
        // Update existing file
        const fileId = existingFiles.result.files[0].id;
        request = window.gapi.client.request({
          path: `/upload/drive/v3/files/${fileId}`,
          method: 'PATCH',
          params: { uploadType: 'multipart' },
          headers: {
            'Content-Type': 'multipart/related; boundary=' + boundary,
          },
          body: multipartRequestBody,
        });
      } else {
        // Create new file
        request = window.gapi.client.request({
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: {
            'Content-Type': 'multipart/related; boundary=' + boundary,
          },
          body: multipartRequestBody,
        });
      }

      const response = await request;
      return response.result;
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
