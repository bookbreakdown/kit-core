import type { BundleStorage } from './BundleStorage';
import { IndexedDbStorage } from './IndexedDbStorage';

export function createStorage(): BundleStorage { return new IndexedDbStorage(); }
