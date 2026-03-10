import { User } from "./User";

export interface TeamJson {
  _id?: string;
  siteName?: string;
  location?: string;
  description?: string;
  isNewSite?: boolean;
  status?: string;
  teamLeader?: any;
  teamLeaderId?: string;
  members?: any[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface TeamOutput {
  _id?: string;
  siteName?: string;
  location?: string;
  description?: string;
  isNewSite?: boolean;
  status?: string;
  teamLeader?: any;
  members?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export class Team {
  id: string;
  siteName: string;
  location: string;
  description: string;
  isNewSite: boolean;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  teamLeaderId: string | null;
  teamLeader: User | null;
  memberIds: string[] | null;
  members: User[] | null;

  constructor(obj?: TeamJson) {
    obj = obj || {};
    
    // Handle leader and members either as objects or as IDs
    let teamLeaderObj: User | null = null;
    if (obj.teamLeader) {
      teamLeaderObj = typeof obj.teamLeader === "object" 
        ? new User(obj.teamLeader) 
        : null;
    }

    let leaderId: string | null =
      typeof obj.teamLeader === "string"
        ? obj.teamLeader
        : teamLeaderObj
        ? teamLeaderObj.id
        : obj.teamLeaderId || null;

    // Members: list of users or list of IDs
    let membersList: User[] | null = null;
    let memberIdList: string[] | null = null;
    
    if (Array.isArray(obj.members) && obj.members.length > 0) {
      if (typeof obj.members[0] === "object") {
        membersList = obj.members.map((m: any) => new User(m));
        memberIdList = membersList.map((m) => m.id);
      } else {
        memberIdList = obj.members.map((m: any) => String(m));
      }
    }

    this.id = obj._id || "";
    this.siteName = obj.siteName || "";
    this.location = obj.location || "";
    this.description = obj.description || "";
    this.isNewSite = !!obj.isNewSite;
    this.status = obj.status || "active";
    this.createdAt = obj.createdAt ? new Date(obj.createdAt) : null;
    this.updatedAt = obj.updatedAt ? new Date(obj.updatedAt) : null;
    this.teamLeaderId = leaderId;
    this.teamLeader = teamLeaderObj;
    this.memberIds = memberIdList;
    this.members = membersList;
  }

  static fromJson(json: TeamJson): Team {
    return new Team(json);
  }

  toJson(): TeamOutput {
    const result: TeamOutput = {
      _id: this.id || undefined,
      siteName: this.siteName || undefined,
      location: this.location || undefined,
      description: this.description || undefined,
      isNewSite: this.isNewSite || undefined,
      status: this.status || undefined,
      teamLeader: this.teamLeader 
        ? this.teamLeader.toJson() 
        : this.teamLeaderId || undefined,
      members: this.members
        ? this.members.map((m) => m.toJson())
        : this.memberIds || [],
    };

    if (this.createdAt) {
      result.createdAt = this.createdAt.toISOString();
    }

    if (this.updatedAt) {
      result.updatedAt = this.updatedAt.toISOString();
    }

    return result;
  }
}