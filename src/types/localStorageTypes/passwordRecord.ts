export interface PasswordRecord {
  id: string; // password and account share id
  hash: string;
  salt: string;
}
