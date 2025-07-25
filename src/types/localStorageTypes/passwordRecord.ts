export interface PasswordRecord {
  id: string; // password and account share ID
  hash: string;
  salt: string;
}
