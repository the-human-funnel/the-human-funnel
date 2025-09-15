import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                role: string;
            };
        }
    }
}
interface User {
    id: string;
    username: string;
    passwordHash: string;
    role: 'admin' | 'recruiter' | 'viewer';
    createdAt: Date;
    lastLogin?: Date;
}
export declare const generateToken: (user: User) => string;
export declare const verifyToken: (token: string) => any;
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const authorize: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const login: (username: string, password: string) => Promise<{
    user: User;
    token: string;
} | null>;
export declare const createUser: (userData: {
    username: string;
    password: string;
    role: "admin" | "recruiter" | "viewer";
}) => Promise<User>;
export declare const getAllUsers: () => {
    id: string;
    username: string;
    role: "admin" | "recruiter" | "viewer";
    createdAt: Date;
    lastLogin: Date | undefined;
}[];
export declare const deleteUser: (username: string) => boolean;
export {};
//# sourceMappingURL=auth.d.ts.map