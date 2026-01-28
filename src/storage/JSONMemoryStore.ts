import fs from 'fs/promises';
import path from 'path';
import { IMemoryStore, SearchResult, SearchFilters } from '../interfaces/IMemoryStore.js';

export class JSONMemoryStore implements IMemoryStore {
  constructor(private storePath: string) {}

  async initialize() {
      await fs.mkdir(this.storePath, { recursive: true });
  }

  async save(key: string, value: any): Promise<void> {
    const filePath = this.getPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  async get(key: string): Promise<any> {
    try {
      const data = await fs.readFile(this.getPath(key), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async update(key: string, partialUpdate: Partial<any>): Promise<void> {
    const existing = await this.get(key) || {};
    await this.save(key, { ...existing, ...partialUpdate });
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
      // Delegated to SemanticSearchEngine
      return []; 
  }

  public getPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return path.join(this.storePath, `${safeKey}.json`);
  }
    
  async loadAll(): Promise<any[]> {
      try {
        const files = await fs.readdir(this.storePath);
        const allData: any[] = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const data = await fs.readFile(path.join(this.storePath, file), 'utf-8');
                try {
                    const parsed = JSON.parse(data);
                    
                    // If this is file-level data with entities array, flatten it
                    if (parsed.entities && Array.isArray(parsed.entities)) {
                      for (const entity of parsed.entities) {
                        allData.push({
                          ...entity,
                          filePath: parsed.filePath || file
                        });
                      }
                    } else {
                      // Individual entity
                      allData.push(parsed);
                    }
                } catch (e) {
                    console.error(`Failed to parse ${file}`, e);
                }
            }
        }
        return allData;
      } catch (e) {
        return [];
      }
  }
}
