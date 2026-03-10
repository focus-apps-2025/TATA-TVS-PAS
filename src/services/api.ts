/// <reference types="vite/client" />
// src/services/api.ts

import axios from "axios";

import type {
    AxiosInstance,
    AxiosResponse,
    AxiosError,
    InternalAxiosRequestConfig,
} from "axios";
// Make sure this path is correct for your project structure
import authManager from './authSession';

// Type definitions
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    [key: string]: any;
}

export interface LoginResponse {
    accessToken: string;
    user: any;
}

export interface User {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    [key: string]: any;
}

export interface Team {
    _id?: string;
    id?: string;
    siteName: string;
    location: string;
    description?: string;
    isNewSite: boolean;
    status: string;
    auditType?: 'TVS' | 'TATA';
    teamLeader?: User | string | null;
    members?: (User | string)[];
    createdAt?: string;
    updatedAt?: string;
    _isFinishWorkAction?: boolean;
    confirmationDialog?: {
        message: string;
        onConfirm: () => void;
    };
    [key: string]: any;
}

export interface Rack {
    _id?: string;
    id?: string;
    rackNo: string;
    partNo: string;
    mrp?: number;
    nextQty: number;
    location: string;
    siteName?: string;
    materialDescription?: string;
    ndp?: number;
    remark?: string;
    scannedBy?: User;
    scannedById?: string;
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
}

interface ScanCounts {
    [userName: string]: number;
}

interface FirstScanData {
    [userName: string]: {
        count: number;
        firstScan: Date | null;
    };
}

export interface RackParams {
    [key: string]: any;
}

interface CreateUserData {
    name: string;
    email: string;
    role: string;
    password?: string;
    isActive?: boolean;
}

interface UpdateUserData extends Partial<CreateUserData> {
    _id?: string;
    id?: string;
}

export interface TeamFormData {
    siteName: string;
    location: string;
    description: string;
    status: string;
    isNewSite: boolean;
    auditType: 'TVS' | 'TATA';
    members?: string[];
    leader?: string;
}

interface ExportRackRow {
    [key: string]: any;
}

// We create a single, configured instance of Axios
const apiService: AxiosInstance = axios.create({
    baseURL: 'http://192.168.1.6:5000/api', //'https://pasbackend.focusengineeringapp.com/api',  //http://192.168.1.46:5000/api ,https://tata-tvs-backend.onrender.com/api
    withCredentials: true, // This is CRUCIAL for sending cookies across domains
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Extend the AxiosRequestConfig to include our custom property
declare module 'axios' {
    export interface AxiosRequestConfig {
        _retry?: boolean;
    }
}

// Request interceptor to attach JWT access token
apiService.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        try {
            // Only attach the Authorization header if the request is NOT for the refresh endpoint
            if (config.url && !config.url.includes('/auth/refresh')) {
                const token = await authManager.getAccessToken(); // This gets the access token
                if (token) {

                    config.headers['Authorization'] = `Bearer ${token}`;
                } else {
                    if (config.headers) {
                        delete config.headers['Authorization'];
                    }
                }
            } else {
                // If it's the refresh endpoint, ensure no Authorization header is sent
                // This is important to prevent the backend from trying to validate an expired access token
                if (config.headers) {
                    delete config.headers['Authorization'];
                }
            }
        } catch (e) {
            console.error('Request interceptor error:', e);
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// Response interceptor (no changes needed here for this specific issue)
apiService.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config;

        // Check if the error is from the refresh token endpoint itself, to prevent loops
        if (originalRequest?.url === '/auth/refresh' && error.response?.status === 401) {
            console.warn("Refresh token endpoint failed. Logging out user.");
            authManager.logout();
            window.location.href = '/login?reason=expired';
            return Promise.reject(error);
        }

        // Check for 401 Unauthorized from other requests (exclude login) and if not already retried
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== '/auth/login') {
            originalRequest._retry = true;
            try {
                console.log("Access token expired. Attempting to refresh token...");
                // This call will now go through the request interceptor *without* the Authorization header
                const response = await apiService.post('/auth/refresh');
                const { accessToken } = response.data;

                if (!accessToken) {
                    throw new Error("Refresh endpoint did not return an access token.");
                }

                authManager.setAccessToken(accessToken); // Update stored access token
                if (originalRequest.headers) {
                    originalRequest.headers['Authorization'] = `Bearer ${accessToken}`; // Update original request with new token
                }

                console.log("Token refreshed, retrying original request.");
                return apiService(originalRequest); // Retry the original request with the new token
            } catch (refreshError) {
                console.error("Token refresh failed. Logging out user.", refreshError);
                authManager.logout();
                window.location.href = '/login?reason=expired';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    },
);

// API methods with exception handling
const api = {
    login: async (email: string, password: string): Promise<ApiResponse> => {
        try {
            const response = await apiService.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
            if (response.data.accessToken) {
                await authManager.saveUserSession(response.data.accessToken, response.data.user);
                return { success: true, user: response.data.user };
            }
            return { success: false, message: response.data.message || 'Login failed' };
        } catch (error: any) {
            console.error('Login Error:', error);
            let message = 'An unexpected error occurred';

            if (error.response) {
                // Server responded with an error
                message = error.response.data?.message || `Server error: ${error.response.status}`;
            } else if (error.request) {
                // Request was made but no response received (Network Error)
                message = 'Network error: Cannot reach the server. Please ensure the backend is running at http://localhost:5000';
            } else {
                // Something else happened
                message = error.message;
            }

            return {
                success: false,
                message: message,
            };
        }
    },

    logout: async (): Promise<void> => {
        try {
            await apiService.post('/auth/logout');
        } catch (error) {
            console.error('Logout Error:', error);
        } finally {
            authManager.logout();
        }
    },

    refreshToken: async (): Promise<{ accessToken: string; user: any }> => {
        const response = await apiService.post('/auth/refresh');
        return response.data;
    },

    // User endpoints
    getAllUsers: (): Promise<User[]> =>
        apiService.get<ApiResponse<{ users: User[] }>>('/auth/users').then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.users || [];
            } else {
                throw new Error(responseBody.message || 'Failed to load users');
            }
        }),

    getUsersByRole: (role: string): Promise<User[]> =>
        apiService.get<ApiResponse<{ users: User[] }>>(`/auth/users/role/${role}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.users || [];
            } else {
                throw new Error(responseBody.message || 'Failed to load users by role');
            }
        }),

    createUser: (userData: CreateUserData): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/auth/register', userData).then(response => {
            const responseBody = response.data;
            if (response.status === 201 && responseBody.success) {
                return {
                    success: true,
                    message: responseBody.message || 'User created successfully',
                    user: responseBody.user,
                };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Failed to create user',
                };
            }
        }).catch((error: any) => {
            console.error('Create User Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error creating user',
                };
            } else {
                return {
                    success: false,
                    message: `Network error creating user: ${error.message}`,
                };
            }
        }),

    updateUser: (userId: string, userData: UpdateUserData): Promise<ApiResponse> =>
        apiService.put<ApiResponse>(`/auth/users/${userId}`, userData).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return {
                    success: true,
                    message: responseBody.message,
                    user: responseBody.user,
                };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Failed to update user',
                };
            }
        }).catch((error: any) => {
            console.error('Update User Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error during user update',
                };
            } else {
                return {
                    success: false,
                    message: `Network error during user update: ${error.message}`,
                };
            }
        }),

    deleteUser: (userId: string): Promise<ApiResponse> =>
        apiService.delete<ApiResponse>(`/auth/users/${userId}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return { success: true, message: responseBody.message };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Failed to delete user',
                };
            }
        }).catch((error: any) => {
            console.error('Delete User Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error during user deletion',
                };
            } else {
                return {
                    success: false,
                    message: `Network error during user deletion: ${error.message}`,
                };
            }
        }),

    // Team endpoints
    getTeams: (): Promise<Team[]> =>
        apiService.get<ApiResponse<{ teams: Team[] }>>('/teams').then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.teams || [];
            } else {
                throw new Error(responseBody.message || 'Failed to load teams');
            }
        }),

    getTeamById: (teamId: string): Promise<Team> =>
        apiService.get<ApiResponse<{ team: Team }>>(`/teams/${teamId}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.team;
            } else {
                throw new Error(responseBody.message || 'Failed to load team');
            }
        }),

    createTeam: (teamData: TeamFormData): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/teams', teamData).then(response => {
            const responseBody = response.data;
            if (response.status === 201 && responseBody.success) {
                return {
                    success: true,
                    message: responseBody.message,
                    team: responseBody.team,
                };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Team creation failed',
                };
            }
        }).catch((error: any) => {
            console.error('Create Team Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error during team creation',
                };
            } else {
                return {
                    success: false,
                    message: `Network error during team creation: ${error.message}`,
                };
            }
        }),

    updateTeam: (teamId: string, teamData: TeamFormData): Promise<ApiResponse> =>
        apiService.put<ApiResponse>(`/teams/${teamId}`, teamData).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return {
                    success: true,
                    message: responseBody.message,
                    team: responseBody.team,
                };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Failed to update team',
                };
            }
        }).catch((error: any) => {
            console.error('Update Team Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error during team update',
                };
            } else {
                return {
                    success: false,
                    message: `Network error during team update: ${error.message}`,
                };
            }
        }),

    deleteTeam: (teamId: string): Promise<ApiResponse> =>
        apiService.delete<ApiResponse>(`/teams/${teamId}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return { success: true, message: responseBody.message };
            } else {
                return {
                    success: false,
                    message: responseBody.message || 'Failed to delete team',
                };
            }
        }).catch((error: any) => {
            console.error('Delete Team Error:', error);
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Server error during team deletion',
                };
            } else {
                return {
                    success: false,
                    message: `Network error during team deletion: ${error.message}`,
                };
            }
        }),

    getTeamsForLeader: (leaderId: string): Promise<Team[]> =>
        apiService.get<ApiResponse<{ teams: Team[] }>>(`/teams/leader/${leaderId}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.teams || [];
            } else {
                throw new Error(responseBody.message || 'Failed to load teams for leader');
            }
        }),

    getTeamsForMember: (memberId: string): Promise<Team[]> =>
        apiService.get<ApiResponse<{ teams: Team[] }>>(`/teams/member/${memberId}`).then(response => {
            const responseBody = response.data;
            if (response.status === 200 && responseBody.success) {
                return responseBody.teams || [];
            } else {
                throw new Error(responseBody.message || 'Failed to load teams for member');
            }
        }),

    // Master description endpoints
    uploadMasterDescriptions: (entries: any[], filename: string): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/masterdesc/upload', {
            entries,
            filename
        }).then(response => response.data),

    getUploadedFilesMetadata: (): Promise<ApiResponse> =>
        apiService.get<ApiResponse>('/masterdesc/files').then(response => response.data),

    deleteUploadedFile: (fileId: string): Promise<ApiResponse> =>
        apiService.delete<ApiResponse>(`/masterdesc/files/${fileId}`).then(response => response.data),

    // Rack endpoints - Add these to your existing api object
    createRack: (rackData: any): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/racks', rackData).then(response => response.data),

    getRacks: (params: RackParams = {}): Promise<{ racks: Rack[], totalCount: number }> =>
        apiService.get<ApiResponse>('/racks', { params }).then(response => {
            const responseData = response.data;
            if (response.status === 200 && responseData.success) {
                // Handle different data formats as in Flutter
                let rackJsonList: Rack[] = [];
                const data = responseData.data;

                if (Array.isArray(data)) {
                    rackJsonList = data;
                } else if (typeof data === 'object' && data !== null) {
                    rackJsonList = Object.values(data);
                }

                return {
                    racks: rackJsonList,
                    totalCount: parseInt(responseData.count) || 0
                };
            } else {
                throw new Error(responseData.message || 'Failed to load racks');
            }
        }),

    exportAllRacks: (params: RackParams = {}): Promise<any[]> =>
        apiService.get<ApiResponse>('/racks/export', { params }).then(response => {
            const responseData = response.data;
            if (response.status === 200 && responseData.success) {
                return responseData.data || [];
            } else {
                throw new Error(responseData.message || 'Failed to export racks');
            }
        }),

    getRackById: (rackId: string): Promise<Rack> =>
        apiService.get<ApiResponse<Rack>>(`/racks/${rackId}`).then(response => {
            const responseData = response.data;
            if (response.status === 200 && responseData.success && responseData.data) {
                return responseData.data;
            } else {
                throw new Error(responseData.message || 'Failed to load rack');
            }
        }).catch((error: any) => {
            if (error.response) {
                throw new Error(error.response.data.message || 'Server error fetching rack by ID');
            } else {
                throw new Error(`Network error fetching rack by ID: ${error.message}`);
            }
        }),

    updateRack: (rackId: string, rackData: any): Promise<ApiResponse> =>
        apiService.put<ApiResponse>(`/racks/${rackId}`, rackData).then(response => {
            const responseData = response.data;
            if (response.status === 200 && responseData.success) {
                return responseData;
            } else {
                throw new Error(responseData.message || 'Failed to update rack');
            }
        }).catch((error: any) => {
            if (error.response) {
                throw new Error(error.response.data.message || 'Server error updating rack');
            } else {
                throw new Error(`Network error updating rack: ${error.message}`);
            }
        }),

    deleteRack: (rackId: string): Promise<ApiResponse> =>
        apiService.delete<ApiResponse>(`/racks/${rackId}`).then(response => {
            const responseData = response.data;
            if (response.status === 200 && responseData.success) {
                return responseData;
            } else {
                throw new Error(responseData.message || 'Failed to delete rack');
            }
        }).catch((error: any) => {
            if (error.response) {
                throw new Error(error.response.data.message || 'Server error deleting rack');
            } else {
                throw new Error(`Network error deleting rack: ${error.message}`);
            }
        }),

    getTotalScanCounts: (teamId: string): Promise<ScanCounts> =>
        apiService.get<ApiResponse>('/racks/scancounts', {
            params: { teamId }
        }).then(response => {
            if (response.data.success === true) {
                const countsData = response.data.data || [];
                return countsData.reduce((acc: ScanCounts, item: any) => {
                    acc[item.userName || 'Unknown'] = item.count || 0;
                    return acc;
                }, {});
            } else {
                throw new Error('Failed to load scan counts');
            }
        }).catch((error: any) => {
            console.error('Error fetching scan counts:', error);
            return {}; // Return empty object on failure
        }),

    checkPartNoInMaster: (partNo: string, siteName: string): Promise<ApiResponse> =>
        apiService.get<ApiResponse>(`/racks/check-master/${partNo}/${siteName}`).then(response => response.data),

    getFirstScanByUser: (teamId: string, date: Date | string): Promise<FirstScanData> => {
        // Format date as YYYY-MM-DD
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const formattedDate = dateObj.toISOString().split('T')[0];

        return apiService.get<ApiResponse>('/racks/first-scan-by-user', {
            params: { teamId, date: formattedDate }
        }).then(response => {
            if (response.status !== 200) {
                throw new Error(response.data.error || 'API Error');
            }

            // Handle different response formats
            let data: any = response.data;
            if (response.data.success && response.data.data) {
                data = response.data.data;
            }

            return Object.keys(data).reduce((acc: FirstScanData, user: string) => {
                const value = data[user];
                let firstScanTime: Date | null = null;

                if (value && typeof value === 'object') {
                    // Handle object format
                    if (value.firstScan) {
                        try {
                            let dateTimeString = value.firstScan;
                            if (!dateTimeString.includes('Z') && !dateTimeString.includes('+')) {
                                dateTimeString += 'Z'; // Assume UTC if no timezone specified
                            }
                            firstScanTime = new Date(dateTimeString);
                        } catch (e) {
                            console.error('Error parsing datetime:', value.firstScan, e);
                        }
                    }

                    acc[user] = {
                        count: value.count || 0,
                        firstScan: firstScanTime
                    };
                } else {
                    // Handle simple value format
                    acc[user] = {
                        count: typeof value === 'number' ? value : 0,
                        firstScan: null
                    };
                }

                return acc;
            }, {});
        }).catch((error: any) => {
            console.error('Error in getFirstScanByUser:', error);
            return {}; // Return empty object on error
        });
    },

    saveExportedRacks: (rows: ExportRackRow[]): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/exported-rack-views/rack-view', { rows })
            .then(response => response.data),

    completeTeamWork: (teamId: string): Promise<ApiResponse> =>
        apiService.put<ApiResponse>(`/teams/${teamId}/complete`)
            .then(response => response.data)
            .catch((error: any) => {
                if (error.response?.data) {
                    return error.response.data;
                }
                return {
                    success: false,
                    message: error.message || 'Unknown error occurred',
                };
            }),

    getTeamWorkStatus: (teamId: string): Promise<boolean> =>
        apiService.get<ApiResponse<{ isSubmitted: boolean }>>(`/teams/${teamId}/status`)
            .then(response => {
                if (response.data.success === true) {
                    return response.data.isSubmitted || false;
                }
                return false;
            })
            .catch((error: any) => {
                console.error('Error checking team status:', error);
                return false;
            }),

    saveExportedRacksSnapshot: (snapshotsData: any[], teamId: string, siteName: string): Promise<ApiResponse> =>
        apiService.post<ApiResponse>('/exported-racks-snapshot', {
            snapshots: snapshotsData,
            teamId,
            siteName
        }).then(response => response.data)
            .catch((error: any) => {
                return {
                    success: false,
                    message: error.response?.data?.message || 'Server error saving snapshot',
                };
            }),
    downloadRacksExcel: (params: RackParams = {}): Promise<Blob> => {
        return apiService.get('/racks/download-excel', {
            params,
            responseType: 'blob'  // Important: get as blob
        }).then(response => response.data);
    },

}

export default api;