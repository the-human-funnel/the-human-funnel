"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = exports.handleMongoError = exports.DatabaseError = exports.database = void 0;
__exportStar(require("./interfaces"), exports);
__exportStar(require("./schemas"), exports);
var database_1 = require("../utils/database");
Object.defineProperty(exports, "database", { enumerable: true, get: function () { return database_1.database; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return database_1.DatabaseError; } });
Object.defineProperty(exports, "handleMongoError", { enumerable: true, get: function () { return database_1.handleMongoError; } });
Object.defineProperty(exports, "withTransaction", { enumerable: true, get: function () { return database_1.withTransaction; } });
//# sourceMappingURL=index.js.map