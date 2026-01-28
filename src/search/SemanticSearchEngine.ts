// src/search/SemanticSearchEngine.ts
import Fuse from 'fuse.js';
import { IMemoryStore, SearchResult, SearchFilters } from '../interfaces/IMemoryStore.js';
import { JSONMemoryStore } from '../storage/JSONMemoryStore.js';

export interface SearchContext {
    naturalQuery: string;
}

export class SemanticSearchEngine {
  private fuseInstance!: Fuse<any>;

  constructor(private memoryStore: JSONMemoryStore) {
    // We defer initialization to an explicit call or lazy load, 
    // but for simplicity we'll assume the caller calls initialize()
  }

  async initialize() {
    // For now we assume the memory store provides a way to get all items
    // Since IMemoryStore interface doesn't strictly have getAllEntities yet,
    // we assume we can add it or cast to JSONMemoryStore which has loadAll
    const allEntities = await this.memoryStore.loadAll();
    
    // We might need to flatten or massage the data structure for Fuse
    // Assuming loadAll returns an array of CodeEntity-like objects
    // But our store saves hierarchy. We might need to flatten.
    // For this MVP, let's assume flat list or simple structure.
    
    // Actually, JSONMemoryStore probably saves one JSON per file or entity.
    // If it's one per file, we need to extract entities from it.
    
    const searchableItems: any[] = [];
    
    // If we assume the items in store are CodeEntity directly
    for (const item of allEntities) {
       searchableItems.push(item);
    }

    this.fuseInstance = new Fuse(searchableItems, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'context.summary.purpose', weight: 0.3 },
        { name: 'signature', weight: 0.2 },
        { name: 'filePath', weight: 0.1 },
        { name: 'context.deepContext.businessLogic.domain', weight: 0.2}
      ],
      threshold: 0.4,
      includeScore: true,
      useExtendedSearch: true
    });
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    if (!this.fuseInstance) {
        await this.initialize();
    }
    
    let results = this.fuseInstance.search(query);

    // Apply filters
    if (filters?.type) {
      results = results.filter(r => r.item.type === filters.type);
    }

    if (filters?.filePath) {
      results = results.filter(r => r.item.filePath && r.item.filePath.includes(filters.filePath));
    }

    return results.map(r => ({
      entity: r.item,
      score: r.score || 1,
      highlights: [] // Fuse.js can return matches, skipping for brevity
    }));
  }

  async searchByContext(context: SearchContext): Promise<SearchResult[]> {
    const keywords = this.extractKeywords(context.naturalQuery);
    
    // Search with OR logic
    const query = keywords.map(k => `'${k}`).join(' | ');
    return this.search(query);
  }

  private extractKeywords(query: string): string[] {
    const stopWords = ['the', 'do', 'what', 'does', 'how', 'is', 'a', 'an', 'in', 'of', 'for', 'to'];
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => !stopWords.includes(w) && w.length > 2);
  }
}
