import { CommType } from '@/constants';

export interface ValidatorStats {
  failedQueries: number;
  longestQueryTime: number; // in milliseconds
}

interface ValidatorStatRecord extends Record<string, ValidatorStats> {}

interface ChainValidatorStats {
  rpc: ValidatorStatRecord;
  rest: ValidatorStatRecord;
}

interface ChainValidatorStatRecord extends Record<string, ChainValidatorStats> {}

export interface ValidatorRecord {
  lastUpdated: string;
  data: ChainValidatorStatRecord;
}

export interface SortedValidator {
  validatorId: string;
  failedQueries: number;
  longestQueryTime: number;
}

export interface UriWithStats {
  uri: string;
  failedQueries: number;
  queryTime: number;
  commType: CommType;
}
