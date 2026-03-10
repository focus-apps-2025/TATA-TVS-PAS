// src/model/user.ts

export interface UserJson {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean | string | null;
}

export interface UserOutput {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export class User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;

  constructor(obj?: UserJson) {
    obj = obj || {};
    
    this.id = obj.id || obj._id || "";
    this.name = obj.name || "";
    this.email = obj.email || "";
    this.role = obj.role || "";
    
    // Handle isActive conversion
    if (typeof obj.isActive === "boolean") {
      this.isActive = obj.isActive;
    } else if (typeof obj.isActive === "string") {
      this.isActive = obj.isActive.toLowerCase() === "true";
    } else if (obj.isActive == null) {
      this.isActive = true;
    } else {
      this.isActive = !!obj.isActive;
    }
  }

  static fromJson(json: UserJson): User {
    return new User(json);
  }

  toJson(): UserOutput {
    return {
      _id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
    };
  }

  get initialLetter(): string {
    return this.name && this.name.length > 0
      ? this.name[0].toUpperCase()
      : "?";
  }
}