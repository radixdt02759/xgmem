import { ICodeParser, ParsedStructure, ParsedEntity } from '../interfaces/ICodeParser.js';
import { IMemoryStore, CodeEntity } from '../interfaces/IMemoryStore.js';
import { JSONMemoryStore } from '../storage/JSONMemoryStore.js';

interface Change {
  type: 'added' | 'modified' | 'deleted';
  entityId: string;
  updates?: any;
}

interface UpdateResult {
  type: 'full' | 'partial' | 'none';
  changes?: number;
  tokensUsed: number;
}

export class IncrementalUpdater {
  constructor(
    private parser: ICodeParser,
    private store: JSONMemoryStore
  ) {}

  async updateFile(filePath: string): Promise<UpdateResult> {
    const newParsed = await this.parser.parseFile(filePath);
    const existingKey = this.filePathToKey(filePath);
    const existing = await this.store.get(existingKey);

    if (!existing) {
      // New file - save all entities
      await this.saveFileData(filePath, newParsed);
      return { type: 'full', tokensUsed: this.estimateTokens(newParsed) };
    }

    // Check if file changed by hash
    if (existing.hash === newParsed.hash) {
      return { type: 'none', tokensUsed: 0 };
    }

    // Find changed entities
    const changes = this.detectChanges(existing.entities || [], newParsed.entities);

    // Update only changed parts
    for (const change of changes) {
      if (change.type === 'deleted') {
        // For now, we just update the file-level data which will have the new entity list
      } else {
        // Update individual entity
        const entityKey = `${existingKey}_${change.entityId}`;
        if (change.updates) {
          await this.store.update(entityKey, change.updates);
        }
      }
    }

    // Also update the file-level metadata (hash, entities list)
    await this.store.update(existingKey, {
      hash: newParsed.hash,
      entities: newParsed.entities,
      lastModified: new Date().toISOString()
    });

    return {
      type: 'partial',
      changes: changes.length,
      tokensUsed: this.estimateTokens(changes)
    };
  }

  private async saveFileData(filePath: string, parsed: ParsedStructure): Promise<void> {
    const key = this.filePathToKey(filePath);
    
    // Save file-level data
    await this.store.save(key, {
      filePath: parsed.filePath,
      hash: parsed.hash,
      entities: parsed.entities,
      lastModified: new Date().toISOString()
    });

    // Also save each entity separately for granular access
    for (const entity of parsed.entities) {
      const entityKey = `${key}_${entity.id}`;
      await this.store.save(entityKey, entity);
    }
  }

  private detectChanges(oldEntities: ParsedEntity[], newEntities: ParsedEntity[]): Change[] {
    const changes: Change[] = [];

    for (const newEntity of newEntities) {
      const oldEntity = oldEntities.find(e => e.id === newEntity.id);

      if (!oldEntity) {
        changes.push({ type: 'added', entityId: newEntity.id, updates: newEntity });
        continue;
      }

      // Detect line-level changes or signature changes
      if (oldEntity.lineRange[0] !== newEntity.lineRange[0] ||
          oldEntity.lineRange[1] !== newEntity.lineRange[1] ||
          oldEntity.signature !== newEntity.signature) {
        changes.push({
          type: 'modified',
          entityId: newEntity.id,
          updates: {
            lineRange: newEntity.lineRange,
            signature: newEntity.signature,
            lastModified: new Date().toISOString()
          }
        });
      }
    }

    // Detect deletions
    for (const oldEntity of oldEntities) {
      if (!newEntities.find(e => e.id === oldEntity.id)) {
        changes.push({ type: 'deleted', entityId: oldEntity.id });
      }
    }

    return changes;
  }

  private filePathToKey(filePath: string): string {
    // Create a safe key from file path
    return `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private estimateTokens(data: any): number {
    // Rough estimation: ~4 characters per token
    const jsonStr = JSON.stringify(data);
    return Math.ceil(jsonStr.length / 4);
  }
}
