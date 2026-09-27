import type { BundleStorage } from './BundleStorage';
import { FileSystemStorage } from './FileSystemStorage';

/** Native default (Metro picks createStorage.web.ts on web). */
export function createStorage(): BundleStorage { return new FileSystemStorage(); }
