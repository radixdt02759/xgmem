import fs from 'fs/promises';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import crypto from 'crypto';
import { ICodeParser, ParsedStructure, ParsedEntity } from '../interfaces/ICodeParser.js';

export class TypeScriptParser implements ICodeParser {
  async parseFile(filePath: string): Promise<ParsedStructure> {
    const code = await fs.readFile(filePath, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties']
    });

    return {
      filePath,
      hash: this.hashContent(code),
      entities: this.extractEntities(ast, filePath) // Pass filePath to entities
    };
  }

  extractEntities(ast: any, filePath: string = ''): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    // We need to handle the traverse default export issue in ESM/TS 
    // Sometimes it's traverse.default depending on how it's imported
    const traverseFn = (traverse as any).default || traverse;

    traverseFn(ast, {
      ClassDeclaration: (path: any) => {
        if (!path.node.id) return;
        entities.push({
          id: this.generateId(path.node.id.name),
          type: 'class',
          name: path.node.id.name,
          lineRange: [path.node.loc.start.line, path.node.loc.end.line],
          filePath,
          
          // Initial empty context structure
          context: {
              summary: { purpose: "", keyBehavior: "", primaryUseCase: "" },
              detailed: { implementation: "", algorithm: "", dependencies: [], outputs: "", sideEffects: "", errorHandling: "", performance: "" }
          }
        } as any); // Type cast as we are mixing ParsedEntity and CodeEntity structures slightly
        
        // Also extract methods
        const methods = this.extractMethods(path, filePath);
        entities.push(...methods);
      },
      
      FunctionDeclaration: (path: any) => {
        if (!path.node.id) return;
        entities.push({
          id: this.generateId(path.node.id.name),
          type: 'function',
          name: path.node.id.name,
          signature: this.buildSignature(path.node),
          lineRange: [path.node.loc.start.line, path.node.loc.end.line],
          filePath,
          context: {
              summary: { purpose: "", keyBehavior: "", primaryUseCase: "" },
              detailed: { implementation: "", algorithm: "", dependencies: [], outputs: "", sideEffects: "", errorHandling: "", performance: "" }
          }
        } as any);
      }
    });

    return entities;
  }

  private extractMethods(classPath: any, filePath: string): ParsedEntity[] {
    const methods: ParsedEntity[] = [];
    
    classPath.traverse({
      ClassMethod: (methodPath: any) => {
        if (methodPath.node.key.type !== 'Identifier') return;
        methods.push({
          id: this.generateId(methodPath.node.key.name),
          type: 'method',
          name: methodPath.node.key.name,
          signature: this.buildSignature(methodPath.node),
          lineRange: [methodPath.node.loc.start.line, methodPath.node.loc.end.line],
          filePath,
           context: {
              summary: { purpose: "", keyBehavior: "", primaryUseCase: "" },
              detailed: { implementation: "", algorithm: "", dependencies: [], outputs: "", sideEffects: "", errorHandling: "", performance: "" }
          }
        } as any);
      }
    });

    return methods;
  }

  private buildSignature(node: any): string {
    const params = node.params.map((p: any) => p.name || 'param').join(', ');
    // Simple signature extraction
    return `(${params})`;
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private generateId(name: string): string {
      return name; // Simple ID for now, could be scoped by file
  }
}
