import { Injectable } from '@angular/core';

export interface EncryptedBackupFileV1 {
  devLensEncryptedBackup: 1;
  salt: string;
  iv: string;
  data: string;
}

@Injectable({ providedIn: 'root' })
export class BackupCryptoService {
  async encryptJson(payload: unknown, passphrase: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const pt = enc.encode(JSON.stringify(payload));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
    const blob: EncryptedBackupFileV1 = {
      devLensEncryptedBackup: 1,
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(ct))),
    };
    return JSON.stringify(blob);
  }

  async decryptJson<T>(jsonText: string, passphrase: string): Promise<T> {
    const o = JSON.parse(jsonText) as EncryptedBackupFileV1;
    if (o.devLensEncryptedBackup !== 1 || !o.salt || !o.iv || !o.data) {
      throw new Error('Invalid backup file');
    }
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const salt = Uint8Array.from(atob(o.salt), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(o.iv), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(o.data), (c) => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(dec.decode(pt)) as T;
  }
}
