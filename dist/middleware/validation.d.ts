import { Request, Response, NextFunction } from 'express';
export declare const sanitizeString: (str: string) => string;
export declare const sanitizeObject: (obj: any) => any;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const handleValidationErrors: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const validateLogin: (((req: Request, res: Response, next: NextFunction) => Response | void) | import("express-validator").ValidationChain)[];
export declare const validateCreateUser: (((req: Request, res: Response, next: NextFunction) => Response | void) | import("express-validator").ValidationChain)[];
export declare const validateObjectIdParam: (((req: Request, res: Response, next: NextFunction) => Response | void) | import("express-validator").ValidationChain)[];
export declare const validatePaginationQuery: (((req: Request, res: Response, next: NextFunction) => Response | void) | import("express-validator").ValidationChain)[];
export declare function validateCreateJobProfile(req: Request, res: Response, next: NextFunction): Response | void;
export declare function validateUpdateJobProfile(req: Request, res: Response, next: NextFunction): Response | void;
export declare function validateObjectId(req: Request, res: Response, next: NextFunction): Response | void;
export declare function validateCandidateSearch(req: Request, res: Response, next: NextFunction): Response | void;
export declare function validateExportParams(req: Request, res: Response, next: NextFunction): Response | void;
//# sourceMappingURL=validation.d.ts.map