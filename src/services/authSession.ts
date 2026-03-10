// src/services/authManager.ts

interface User {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

class AuthManager {
  private _accessToken: string | null = null;
  private _currentUser: User | null = null;

  constructor() {
    // Initialize from sessionStorage to survive refreshes
    this._accessToken = sessionStorage.getItem('accessToken');
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
      try {
        this._currentUser = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from session storage', e);
      }
    }
  }

  // --- Access Token Methods ---
  async setAccessToken(token: string | null): Promise<void> {
    this._accessToken = token;
    if (token) {
      sessionStorage.setItem('accessToken', token);
    } else {
      sessionStorage.removeItem('accessToken');
    }
  }

  async getAccessToken(): Promise<string | null> {
    return this._accessToken || sessionStorage.getItem('accessToken');
  }

  async clearAccessToken(): Promise<void> {
    this._accessToken = null;
    sessionStorage.removeItem('accessToken');
  }

  // --- Current User Methods ---
  async setCurrentUser(user: User | null): Promise<void> {
    this._currentUser = user;
    if (user) {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('currentUser');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this._currentUser) {
      const userStr = sessionStorage.getItem('currentUser');
      if (userStr) {
        try {
          this._currentUser = JSON.parse(userStr);
        } catch (e) {
          console.error('Failed to parse user from session storage', e);
        }
      }
    }
    return this._currentUser;
  }

  async clearCurrentUser(): Promise<void> {
    this._currentUser = null;
    sessionStorage.removeItem('currentUser');
  }

  // --- Session Helper Methods ---
  async saveUserSession(token: string, user: User): Promise<void> {
    await this.setAccessToken(token);
    await this.setCurrentUser(user);
  }

  async logout(): Promise<void> {
    await this.clearAccessToken();
    await this.clearCurrentUser();
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await this.getAccessToken();
    const user = await this.getCurrentUser();
    return !!(token && user);
  }
}

// Create and export a single instance to be used throughout your app
const authManager = new AuthManager();
export default authManager;