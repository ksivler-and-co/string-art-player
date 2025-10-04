import googleAuth from './googleAuthService';

const APP_FOLDER_NAME = 'CodeDisplayApp';
const STATE_FILE_NAME = 'app-state.json';

class GoogleDriveService {
  constructor() {}

  // Create or get app folder
  async getOrCreateAppFolder() {
    try {
      // Check if user is authenticated
      if (!googleAuth.isSignedIn()) {
        throw new Error('User not authenticated');
      }

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
      // Check if user is authenticated
      if (!googleAuth.isSignedIn()) {
        throw new Error('User not authenticated');
      }
      
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
      // Check if user is authenticated
      if (!googleAuth.isSignedIn()) {
        throw new Error('User not authenticated');
      }

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
      // Check if user is authenticated
      if (!googleAuth.isSignedIn()) {
        throw new Error('User not authenticated');
      }

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
