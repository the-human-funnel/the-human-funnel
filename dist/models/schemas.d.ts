import { Document } from 'mongoose';
import { JobProfile, Candidate, ProcessingBatch } from './interfaces';
export declare const JobProfileModel: import("mongoose").Model<JobProfile & Document<unknown, any, any, Record<string, any>, {}>, {}, {}, {}, Document<unknown, {}, JobProfile & Document<unknown, any, any, Record<string, any>, {}>, {}, {}> & JobProfile & Document<unknown, any, any, Record<string, any>, {}> & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const CandidateModel: import("mongoose").Model<Candidate & Document<unknown, any, any, Record<string, any>, {}>, {}, {}, {}, Document<unknown, {}, Candidate & Document<unknown, any, any, Record<string, any>, {}>, {}, {}> & Candidate & Document<unknown, any, any, Record<string, any>, {}> & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const ProcessingBatchModel: import("mongoose").Model<ProcessingBatch & Document<unknown, any, any, Record<string, any>, {}>, {}, {}, {}, Document<unknown, {}, ProcessingBatch & Document<unknown, any, any, Record<string, any>, {}>, {}, {}> & ProcessingBatch & Document<unknown, any, any, Record<string, any>, {}> & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=schemas.d.ts.map