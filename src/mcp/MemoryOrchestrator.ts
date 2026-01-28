import { ICodeParser, ParsedStructure } from '../interfaces/ICodeParser.js';
import { IMemoryStore, SearchResult, SearchFilters, CodeEntity } from '../interfaces/IMemoryStore.js';
import { JSONMemoryStore } from '../storage/JSONMemoryStore.js';
import { SemanticSearchEngine } from '../search/SemanticSearchEngine.js';
import { IncrementalUpdater } from '../updates/IncrementalUpdater.js';
import { TypeScriptParser } from '../parsers/TypeScriptParser.js';
import fs from 'fs/promises';
import path from 'path';

export class MemoryOrchestrator {
  private parser: ICodeParser;
  private store: JSONMemoryStore;
  private searchEngine: SemanticSearchEngine;
  private updater: IncrementalUpdater;

  constructor(storePath: string) {
    this.parser = new TypeScriptParser();
    this.store = new JSONMemoryStore(storePath);
    this.searchEngine = new SemanticSearchEngine(this.store);
    this.updater = new IncrementalUpdater(this.parser, this.store);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    await this.searchEngine.initialize();
  }

  /**
   * Track (index) a file into the memory system
   */
  async trackFile(filePath: string): Promise<{ type: string; changes?: number; tokensUsed: number }> {
    return await this.updater.updateFile(filePath);
  }

  /**
   * Search for code entities
   */
  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    return await this.searchEngine.search(query, filters);
  }

  /**
   * Get a specific entity by ID or name
   */
  async getEntity(entityId: string): Promise<CodeEntity | null> {
    try {
      const filesDir = path.dirname(this.store.getPath('dummy'));
      const files = await fs.readdir(filesDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(filesDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Check if this is a file-level data or entity-level
        if (parsed.entities) {
          // File-level data
          const entity = parsed.entities.find((e: any) => e.id === entityId || e.name === entityId);
          if (entity) {
            return entity as CodeEntity;
          }
        } else if (parsed.id === entityId || parsed.name === entityId) {
          // Entity-level data
          return parsed as CodeEntity;
        }
      }
    } catch (error) {
      console.error('Error getting entity:', error);
    }
    
    return null;
  }

  /**
   * Update the purpose/description of an entity
   */
  async updateEntityPurpose(entityId: string, purpose: string): Promise<boolean> {
    try {
      const filesDir = path.dirname(this.store.getPath('dummy'));
      const files = await fs.readdir(filesDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(filesDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        if (parsed.entities) {
          // File-level data
          const entity = parsed.entities.find((e: any) => e.id === entityId || e.name === entityId);
          if (entity) {
            if (!entity.context) {
              entity.context = {
                summary: { purpose: '', keyBehavior: '', primaryUseCase: '' },
                detailed: { implementation: '', algorithm: '', dependencies: [], outputs: '', sideEffects: '', errorHandling: '', performance: '' }
              };
            }
            entity.context.summary.purpose = purpose;
            
            await fs.writeFile(filePath, JSON.stringify(parsed, null, 2));
            
            // Reinitialize search to pick up changes
            await this.searchEngine.initialize();
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error updating entity purpose:', error);
    }
    
    return false;
  }

  /**
   * Update detailed context for an entity
   */
  async updateEntityContext(entityId: string, contextUpdate: Partial<CodeEntity['context']>): Promise<boolean> {
    try {
      const filesDir = path.dirname(this.store.getPath('dummy'));
      const files = await fs.readdir(filesDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(filesDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        if (parsed.entities) {
          const entity = parsed.entities.find((e: any) => e.id === entityId || e.name === entityId);
          if (entity) {
            entity.context = {
              ...entity.context,
              ...contextUpdate,
              summary: { ...entity.context?.summary, ...contextUpdate?.summary },
              detailed: { ...entity.context?.detailed, ...contextUpdate?.detailed }
            };
            
            await fs.writeFile(filePath, JSON.stringify(parsed, null, 2));
            await this.searchEngine.initialize();
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error updating entity context:', error);
    }
    
    return false;
  }
}
