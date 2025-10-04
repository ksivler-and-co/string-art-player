const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ');

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Token storage keys
const TOKEN_STORAGE_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';
const USER_INFO_KEY = 'google_user_info';
const REFRESH_SCHEDULED_TIME_KEY = 'google_token_refresh_scheduled_time'; // NEW

// Refresh token 5 minutes before expiration (so every 55 minutes)
const REFRESH_TOKEN_BEFORE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

class GoogleAuthService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.gapiInited = false;
    this.gisInited = false;
    this.refreshTimer = null;
    this.isRefreshing = false;
    this.refreshCallbacks = [];
    this.onTokenExpired = null;
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
        const restored = this.restoreToken();
        if (restored) {
          console.log('[Auth] Token restored and auto-refresh scheduled');
        }
        
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
        this.handleTokenResponse(response);
        
        if (callback) callback(response);
      },
    });
    this.gisInited = true;
  }

  // Handle token response and set up auto-refresh
  handleTokenResponse(response) {
    this.accessToken = response.access_token;
    
    // Calculate expiry time (tokens typically last 3600 seconds = 1 hour)
    const expiresIn = response.expires_in || 3600;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    console.log(`[Auth] Token will expire in ${Math.round(expiresIn/60)} minutes`);
    
    // Save token to localStorage
    this.saveToken();
    
    // Set token for gapi client
    window.gapi.client.setToken({ access_token: this.accessToken });
    
    // Schedule automatic token refresh
    this.scheduleTokenRefresh();
  }

  // Schedule token refresh before expiration
  scheduleTokenRefresh() {
    // Clear previous timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.tokenExpiry) return;

    // Calculate time until refresh (10 minutes before expiration)
    const timeUntilRefresh = this.tokenExpiry - Date.now() - REFRESH_TOKEN_BEFORE_EXPIRY;
    const scheduledRefreshTime = Date.now() + Math.max(0, timeUntilRefresh);
    
    // Save scheduled refresh time to localStorage
    localStorage.setItem(REFRESH_SCHEDULED_TIME_KEY, scheduledRefreshTime.toString());
    
    if (timeUntilRefresh > 0) {
      console.log(`[Auth] Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes at ${new Date(scheduledRefreshTime).toLocaleTimeString()}`);
      
      this.refreshTimer = setTimeout(() => {
        this.refreshTokenSilently();
      }, timeUntilRefresh);
    } else {
      // Token expires soon, refresh immediately
      console.log('[Auth] Token expires soon, refreshing immediately');
      this.refreshTokenSilently();
    }
  }

  // Restore scheduled refresh timer from localStorage
  restoreScheduledRefresh() {
    const scheduledRefreshTimeStr = localStorage.getItem(REFRESH_SCHEDULED_TIME_KEY);
    
    if (!scheduledRefreshTimeStr || !this.tokenExpiry) {
      return false;
    }

    const scheduledRefreshTime = parseInt(scheduledRefreshTimeStr);
    const currentTime = Date.now();
    const timeUntilRefresh = scheduledRefreshTime - currentTime;

    if (timeUntilRefresh > 0) {
      // Schedule refresh based on stored time
      console.log(`[Auth] Restored refresh timer, will refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
      
      this.refreshTimer = setTimeout(() => {
        this.refreshTokenSilently();
      }, timeUntilRefresh);
      
      return true;
    } else {
      // Scheduled refresh time has passed, refresh immediately
      console.log('[Auth] Scheduled refresh time has passed, refreshing immediately');
      this.refreshTokenSilently();
      return true;
    }
  }

  // Silent token refresh without showing UI
  async refreshTokenSilently() {
    if (this.isRefreshing) {
      // If already refreshing, wait for completion
      return new Promise((resolve, reject) => {
        this.refreshCallbacks.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    console.log('[Auth] Attempting silent token refresh...');

    try {
      await new Promise((resolve, reject) => {
        // Temporarily set callback for silent refresh
        const originalCallback = this.tokenClient.callback;
        
        this.tokenClient.callback = (response) => {
          if (response.error !== undefined) {
            console.error('[Auth] Silent refresh failed:', response.error);
            reject(response);
            return;
          }
          
          console.log('[Auth] Silent refresh successful');
          this.handleTokenResponse(response);
          resolve(response);
        };

        // Request new token without showing UI
        this.tokenClient.requestAccessToken({ prompt: '' });
        
        // Restore original callback after 5 seconds
        setTimeout(() => {
          this.tokenClient.callback = originalCallback;
        }, 5000);
      });

      // Execute all waiting callbacks
      this.refreshCallbacks.forEach(cb => cb.resolve());
      this.refreshCallbacks = [];

    } catch (error) {
      console.error('[Auth] Silent token refresh failed:', error);
      
      // If silent refresh failed, clear token and scheduled refresh
      this.clearToken();
      
      // Execute all waiting callbacks with error
      this.refreshCallbacks.forEach(cb => cb.reject(error));
      this.refreshCallbacks = [];
      
      // Notify about token expiration
      this.notifyTokenExpired();
    } finally {
      this.isRefreshing = false;
    }
  }

  // Notify about token expiration
  notifyTokenExpired() {
    console.warn('[Auth] Google authentication expired. Please sign in again.');
    if (this.onTokenExpired) {
      this.onTokenExpired();
    }
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
    console.log('[Auth] Attempting to restore token from storage');
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    if (storedToken && storedExpiry) {
      console.log('[Auth] Found stored token and expiry');
      const expiry = parseInt(storedExpiry);
      
      // Check if token is still valid (with 5 minute buffer)
      if (Date.now() < expiry - (5 * 60 * 1000)) {
        this.accessToken = storedToken;
        this.tokenExpiry = expiry;
        
        // Set token for gapi client
        if (this.gapiInited) {
          window.gapi.client.setToken({ access_token: this.accessToken });
        }
        
        // Try to restore scheduled refresh timer
        const refreshRestored = this.restoreScheduledRefresh();
        
        if (!refreshRestored) {
          // If no scheduled refresh was restored, create a new one
          console.log('[Auth] No scheduled refresh found, creating new one');
          this.scheduleTokenRefresh();
        }
        
        return true;
      } else {
        // Token expired, clear it
        console.log('[Auth] Stored token expired, clearing');
        this.clearToken();
      }
    }
    
    return false;
  }

  // Clear stored token, refresh timer, and scheduled refresh time
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Clear all localStorage items related to auth
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(REFRESH_SCHEDULED_TIME_KEY); // Clear scheduled refresh time
  }

  // Check if user is signed in
  isSignedIn() {
    if (this.accessToken && this.tokenExpiry) {
      if (Date.now() < this.tokenExpiry - (5 * 60 * 1000)) {
        return true;
      } else {
        this.clearToken();
        return false;
      }
    }
    return false;
  }

  // Sign in - Request access token
  async signIn() {
    console.log('[Auth] Starting sign-in process');
    return new Promise((resolve, reject) => {
      if (!this.gisInited || !this.gapiInited) {
        console.log('[Auth] Services not initialized');
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
          
          this.handleTokenResponse(response);
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
    console.log('[Auth] Starting sign-out process');
    if (this.accessToken) {
      console.log('[Auth] Revoking access token...');
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('[Auth] Access token revoked successfully');
      });
      
      this.clearToken();
      window.gapi.client.setToken(null);
    }
  }

  // Ensure valid token before API requests
  async ensureValidToken() {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in or token expired');
    }

    // If token expires soon, try to refresh it
    const timeUntilExpiry = this.tokenExpiry - Date.now();
    if (timeUntilExpiry < REFRESH_TOKEN_BEFORE_EXPIRY) {
      console.log('[Auth] Token expires soon, refreshing before API call...');
      await this.refreshTokenSilently();
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
      console.error('[Auth] Error getting user info:', error);
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

  // Get the current access token
  getAccessToken() {
    return this.accessToken;
  }

  // Check if services are initialized
  isInitialized() {
    return this.gapiInited && this.gisInited;
  }

  // Set token expiration handler
  setTokenExpiredHandler(handler) {
    this.onTokenExpired = handler;
  }

  // Get time until token expires (in milliseconds)
  getTimeUntilExpiry() {
    if (!this.tokenExpiry) return 0;
    return Math.max(0, this.tokenExpiry - Date.now());
  }

  // Get token expiry as Date object
  getTokenExpiryDate() {
    if (!this.tokenExpiry) return null;
    return new Date(this.tokenExpiry);
  }

  // Get scheduled refresh time as Date object (for debugging/monitoring)
  getScheduledRefreshTime() {
    const scheduledTime = localStorage.getItem(REFRESH_SCHEDULED_TIME_KEY);
    if (!scheduledTime) return null;
    return new Date(parseInt(scheduledTime));
  }

  // Check if refresh is currently scheduled
  isRefreshScheduled() {
    return this.refreshTimer !== null;
  }
}

export default new GoogleAuthService();
