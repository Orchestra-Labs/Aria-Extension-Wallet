import { lib, SHA512 } from 'crypto-js';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { PasswordRecord } from '@/types';

const PASSWORD_KEY = 'passwordHash';

export const getPasswordRecords = (): PasswordRecord[] => {
  const storedData = getLocalStorageItem(PASSWORD_KEY);
  return storedData ? JSON.parse(storedData) : [];
};

const savePasswordRecords = (passwordRecords: PasswordRecord[]): void => {
  setLocalStorageItem(PASSWORD_KEY, JSON.stringify(passwordRecords));
};

export const hashPassword = (password: string, salt: string): string => {
  console.log(`Hashing password with salt: ${salt}`);
  const hashed = SHA512(password + salt).toString();
  console.log('Generated hash:', hashed);
  return hashed;
};

export const getPasswordIndexById = (passwordId: string): number => {
  console.log('Searching for password hash in records');
  const passwords = getPasswordRecords();
  const index = passwords.findIndex(record => record.id === passwordId);

  return index;
};

export const savePasswordHash = (id: string, password: string): string => {
  console.log('Storing password hash');
  const passwords = getPasswordRecords();
  const existingIndex = passwords.findIndex(
    record => hashPassword(password, record.salt) === record.hash,
  );

  // If password hash already exists, return it
  if (existingIndex !== -1) {
    console.log('Password hash already exists in records:', passwords[existingIndex].hash);
    return passwords[existingIndex].hash;
  }

  // If no existing hash, create a new password record
  const salt = lib.WordArray.random(16).toString();
  const passwordHash = hashPassword(password, salt);
  passwords.push({ id: id, hash: passwordHash, salt });

  savePasswordRecords(passwords);
  console.log('New password hash stored:', passwordHash);
  return passwordHash;
};

export const updatePassword = (
  passwordId: string,
  oldPassword: string,
  newPassword: string,
): string | null => {
  console.log('Updating password hash');
  const passwords = getPasswordRecords();
  const index = passwords.findIndex(record => record.id === passwordId);

  if (index === -1) {
    console.warn(`Password record with ID ${passwordId} not found.`);
    return null;
  }

  const storedPasswordRecord = passwords[index];
  const oldPasswordHash = hashPassword(oldPassword, storedPasswordRecord.salt);

  if (oldPasswordHash !== storedPasswordRecord.hash) {
    console.warn(
      'Old password does not match the current stored password hash. Operation aborted.',
    );
    return null;
  }

  const newSalt = lib.WordArray.random(16).toString();
  const newHash = hashPassword(newPassword, newSalt);
  passwords[index] = { id: passwordId, hash: newHash, salt: newSalt };

  savePasswordRecords(passwords);
  console.log('Password hash updated successfully:', newHash);

  return newHash;
};

export const removePassword = (id: string): boolean => {
  console.log(`Attempting to remove password hash: ${id}`);
  const passwords = getPasswordRecords();

  const index = passwords.findIndex(record => record.id === id);

  if (index !== -1) {
    passwords.splice(index, 1);
    savePasswordRecords(passwords);
    console.log('Password hash removed successfully.');
    return true;
  }

  console.warn('Password hash not found, removal unsuccessful');
  return false;
};
