export interface ValidatorStats {
  failedQueries: number;
  longestQueryTime: number; // in milliseconds
}

export interface ValidatorStatRecord extends Record<string, ValidatorStats> {}

export interface ChainValidatorStats {
  rpc: ValidatorStatRecord;
  rest: ValidatorStatRecord;
}

export interface ChainValidatorStatRecord extends Record<string, ChainValidatorStats> {}
export interface AccountChainValidatorStatRecord extends Record<string, ChainValidatorStatRecord> {}

export interface ValidatorRecord {
  lastUpdated: string;
  data: ChainValidatorStatRecord;
}

export interface SortedValidator {
  validatorId: string;
  failedQueries: number;
  longestQueryTime: number;
}
