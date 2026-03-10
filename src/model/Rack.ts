import { User } from "./User";
import { Team } from "./Team";

function parseIntSafe(val: any, defaultValue: number = 0): number {
  if (typeof val === "number") return Math.floor(val);
  if (typeof val === "string") return parseInt(val, 10) || defaultValue;
  return defaultValue;
}

function parseFloatSafe(val: any): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val);
  return null;
}

export interface RackJson {
  _id?: string;
  rackNo?: string;
  partNo?: string;
  mrp?: any;
  nextQty?: any;
  location?: string;
  siteName?: string;
  scannedBy?: any;
  scannedById?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  materialDescription?: string;
  ndp?: any;
  team?: any;
}

export class Rack {
  id: string;
  rackNo: string;
  partNo: string;
  mrp: number | null;
  nextQty: number;
  location: string;
  siteName: string;
  scannedById: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  materialDescription: string;
  ndp: number | null;
  team: Team | null;
  scannedBy: User | null;

  constructor(obj?: RackJson) {
    obj = obj || {};
    
    // ScannedBy may be object or ID
    let scannedByObj: User | null =
      typeof obj.scannedBy === "object"
        ? new User(obj.scannedBy)
        : null;
    
    let scannedById: string =
      typeof obj.scannedBy === "string"
        ? obj.scannedBy
        : scannedByObj
        ? scannedByObj.id
        : obj.scannedById || "";

    // Team: object or undefined
    let teamObj: Team | null =
      typeof obj.team === "object" ? new Team(obj.team) : null;

    this.id = obj._id || "";
    this.rackNo = obj.rackNo || "";
    this.partNo = obj.partNo || "";
    this.mrp = parseFloatSafe(obj.mrp);
    this.nextQty = parseIntSafe(obj.nextQty);
    this.location = obj.location || "";
    this.siteName = obj.siteName || "";
    this.scannedById = scannedById;
    this.createdAt = obj.createdAt ? new Date(obj.createdAt) : null;
    this.updatedAt = obj.updatedAt ? new Date(obj.updatedAt) : null;
    this.materialDescription = obj.materialDescription || "";
    this.ndp = parseFloatSafe(obj.ndp);
    this.team = teamObj;
    this.scannedBy = scannedByObj;
  }

  static fromJson(json: RackJson): Rack {
    return new Rack(json);
  }

  toJson(): Partial<RackJson> {
    return {
      _id: this.id || undefined,
      rackNo: this.rackNo || undefined,
      partNo: this.partNo || undefined,
      mrp: this.mrp || undefined,
      nextQty: this.nextQty || undefined,
      location: this.location || undefined,
      siteName: this.siteName || undefined,
      scannedById: this.scannedById || undefined,
      createdAt: this.createdAt ? this.createdAt.toISOString() : undefined,
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : undefined,
      materialDescription: this.materialDescription || undefined,
      ndp: this.ndp || undefined,
    };
  }
}