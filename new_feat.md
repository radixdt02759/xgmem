
Senior Engineering Plan: Intelligent Code Memory System (ICMS)
Executive Summary
We're architecting a scalable, efficient code intelligence system that replaces naive file-based memory storage with a structured, queryable knowledge graph. This solves three critical problems: token waste, poor search accuracy, and lack of semantic understanding of code relationships.

Problem Analysis
Current State Issues

Token Inefficiency: Reading entire MD files for simple queries burns tokens
Poor Searchability: Full-text search lacks semantic understanding
No Structural Awareness: No mapping between files, classes, methods
Update Complexity: Modifying documentation requires rewriting entire files
Context Loss: Agent can't understand "what does this method do" without reading everything

Real-World Impact

Cost: $0.15-$0.50 per complex query with current approach
Latency: 2-5s to search large markdown files
Accuracy: ~40% relevant results due to keyword-only matching
Maintenance: Manual sync between code and documentation


Solution Architecture (SOLID Principles Applied)
Core Design Principles
1. Single Responsibility Principle (SRP)
Each component has ONE job:

MemoryStore: Persistence layer only
SemanticSearchEngine: Search logic only
CodeParser: AST analysis only
RelationshipMapper: Graph construction only

2. Open/Closed Principle (OCP)

Extensible parsers for new languages (TypeScript, Python, Rust)
Pluggable storage backends (JSON, SQLite, PostgreSQL)
Custom search strategies without modifying core

3. Liskov Substitution Principle (LSP)

All parsers implement ICodeParser interface
All stores implement IMemoryStore interface
Swap implementations without breaking system

4. Interface Segregation Principle (ISP)
typescriptinterface ICodeParser {
  parse(file: string): ParsedStructure;
}

interface ISearchEngine {
  search(query: string): SearchResult[];
}

interface IMemoryStore {
  save(entity: CodeEntity): Promise<void>;
  retrieve(id: string): Promise<CodeEntity>;
}
5. Dependency Inversion Principle (DIP)

High-level MemoryOrchestrator depends on abstractions
Concrete implementations injected via constructor


Data Model Design
Hierarchical JSON Structure
json{
  "project": {
    "name": "ecommerce-api",
    "root": "/src",
    "files": {
      "product.ts": {
        "id": "file_001",
        "path": "/src/services/product.ts",
        "lastModified": "2026-01-28T10:30:00Z",
        "hash": "a3f5c9d...",
        "entities": {
          "ProductService": {
            "type": "class",
            "line": [10, 150],
            "purpose": "Manages product CRUD operations with inventory sync",
            "dependencies": ["InventoryService", "PriceCalculator"],
            "methods": {
              "calculateDiscount": {
                "line": [45, 67],
                "signature": "(price: number, category: string): number",
                "purpose": "Applies category-specific discount rules",
                "updates": [
                  {
                    "date": "2026-01-20",
                    "changes": "Added seasonal discount logic",
                    "lines": [52, 58]
                  }
                ],
                "relations": {
                  "calls": ["PriceCalculator.getBaseTier"],
                  "calledBy": ["OrderService.finalizePrice"]
                }
              }
            }
          }
        },
        "imports": ["express", "./inventory"],
        "exports": ["ProductService"]
      }
    },
    "relationships": {
      "inheritance": [
        {"child": "PremiumProductService", "parent": "ProductService"}
      ],
      "composition": [
        {"container": "OrderService", "component": "ProductService"}
      ]
    }
  }
}
Key Benefits

Granular Access: Retrieve only method-level data
Relationship Tracking: Understand call chains
Change History: Incremental updates with line ranges
Fast Lookups: O(1) access by ID, O(log n) by fuzzy search


Implementation Plan
Phase 1: Core Infrastructure (Week 1-2)
1.1 Abstract Interfaces
typescript// src/interfaces/ICodeParser.ts
export interface ParsedEntity {
  id: string;
  type: 'class' | 'function' | 'method' | 'variable';
  name: string;
  purpose?: string;
  lineRange: [number, number];
  signature?: string;
}

export interface ICodeParser {
  parseFile(filePath: string): Promise<ParsedStructure>;
  extractEntities(ast: any): ParsedEntity[];
}

// src/interfaces/IMemoryStore.ts
export interface IMemoryStore {
  save(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  update(key: string, partialUpdate: Partial<any>): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult[]>;
}
1.2 Storage Layer (JSON-based MVP)
typescript// src/storage/JSONMemoryStore.ts
import fs from 'fs/promises';
import path from 'path';

export class JSONMemoryStore implements IMemoryStore {
  constructor(private storePath: string) {}

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

  private getPath(key: string): string {
    // Convert "files/product.ts/ProductService" -> "store/files_product_ts_ProductService.json"
    return path.join(this.storePath, `${key.replace(/\//g, '_')}.json`);
  }
}
Phase 2: Code Parsing (Week 2-3)
2.1 TypeScript Parser (using @babel/parser)
typescript// src/parsers/TypeScriptParser.ts
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export class TypeScriptParser implements ICodeParser {
  async parseFile(filePath: string): Promise<ParsedStructure> {
    const code = await fs.readFile(filePath, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy']
    });

    return {
      filePath,
      hash: this.hashContent(code),
      entities: this.extractEntities(ast)
    };
  }

  extractEntities(ast: any): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    traverse(ast, {
      ClassDeclaration(path) {
        entities.push({
          id: this.generateId(path.node.id.name),
          type: 'class',
          name: path.node.id.name,
          lineRange: [path.node.loc.start.line, path.node.loc.end.line],
          methods: this.extractMethods(path)
        });
      },
      
      FunctionDeclaration(path) {
        entities.push({
          id: this.generateId(path.node.id.name),
          type: 'function',
          name: path.node.id.name,
          signature: this.buildSignature(path.node),
          lineRange: [path.node.loc.start.line, path.node.loc.end.line]
        });
      }
    });

    return entities;
  }

  private extractMethods(classPath: any): ParsedEntity[] {
    const methods: ParsedEntity[] = [];
    
    classPath.traverse({
      ClassMethod(methodPath) {
        methods.push({
          id: this.generateId(methodPath.node.key.name),
          type: 'method',
          name: methodPath.node.key.name,
          signature: this.buildSignature(methodPath.node),
          lineRange: [methodPath.node.loc.start.line, methodPath.node.loc.end.line]
        });
      }
    });

    return methods;
  }

  private buildSignature(node: any): string {
    const params = node.params.map(p => `${p.name}: ${this.getType(p)}`).join(', ');
    const returnType = this.getReturnType(node);
    return `(${params}): ${returnType}`;
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}
Phase 3: Semantic Search Engine (Week 3-4)
3.1 Fuse.js Integration
typescript// src/search/SemanticSearchEngine.ts
import Fuse from 'fuse.js';

export class SemanticSearchEngine implements ISearchEngine {
  private fuseInstance: Fuse<any>;

  constructor(private memoryStore: IMemoryStore) {
    this.initializeFuse();
  }

  private async initializeFuse() {
    const allEntities = await this.loadAllEntities();
    
    this.fuseInstance = new Fuse(allEntities, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'purpose', weight: 0.3 },
        { name: 'signature', weight: 0.2 },
        { name: 'filePath', weight: 0.1 }
      ],
      threshold: 0.3, // 70% match required
      includeScore: true,
      useExtendedSearch: true
    });
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    let results = this.fuseInstance.search(query);

    // Apply filters
    if (filters?.type) {
      results = results.filter(r => r.item.type === filters.type);
    }

    if (filters?.filePath) {
      results = results.filter(r => r.item.filePath.includes(filters.filePath));
    }

    return results.map(r => ({
      entity: r.item,
      score: r.score,
      highlights: this.getHighlights(r)
    }));
  }

  async searchByContext(context: SearchContext): Promise<SearchResult[]> {
    // "What does the discount calculation method do?"
    // -> Extract: ["discount", "calculation", "method"]
    const keywords = this.extractKeywords(context.naturalQuery);
    
    // Search with OR logic
    const query = keywords.map(k => `'${k}`).join(' | ');
    return this.search(query, { type: 'method' });
  }

  private extractKeywords(query: string): string[] {
    // Simple NLP: remove stop words, extract nouns/verbs
    const stopWords = ['the', 'do', 'what', 'does', 'how'];
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => !stopWords.includes(w) && w.length > 2);
  }
}
Phase 4: Incremental Update System (Week 4-5)
4.1 Smart Diff Engine
typescript// src/updates/IncrementalUpdater.ts
import { diffLines } from 'diff';

export class IncrementalUpdater {
  constructor(
    private parser: ICodeParser,
    private store: IMemoryStore
  ) {}

  async updateFile(filePath: string): Promise<UpdateResult> {
    const newParsed = await this.parser.parseFile(filePath);
    const existingKey = `files/${filePath}`;
    const existing = await this.store.get(existingKey);

    if (!existing) {
      // New file
      await this.store.save(existingKey, newParsed);
      return { type: 'full', tokensUsed: this.estimateTokens(newParsed) };
    }

    // Check if file changed
    if (existing.hash === newParsed.hash) {
      return { type: 'none', tokensUsed: 0 };
    }

    // Find changed entities
    const changes = this.detectChanges(existing.entities, newParsed.entities);

    // Update only changed parts
    for (const change of changes) {
      await this.store.update(
        `${existingKey}/${change.entityId}`,
        change.updates
      );
    }

    return {
      type: 'partial',
      changes: changes.length,
      tokensUsed: this.estimateTokens(changes)
    };
  }

  private detectChanges(oldEntities: any[], newEntities: any[]): Change[] {
    const changes: Change[] = [];

    for (const newEntity of newEntities) {
      const oldEntity = oldEntities.find(e => e.id === newEntity.id);

      if (!oldEntity) {
        changes.push({ type: 'added', entityId: newEntity.id, updates: newEntity });
        continue;
      }

      // Detect line-level changes
      if (oldEntity.lineRange[0] !== newEntity.lineRange[0] ||
          oldEntity.lineRange[1] !== newEntity.lineRange[1]) {
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
}
Phase 5: MCP Server Integration (Week 5-6)
5.1 MCP Tool Definitions
typescript// src/mcp/tools.ts
export const tools = [
  {
    name: 'code_memory_search',
    description: 'Search code entities by natural language or keywords',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        filters: {
          type: 'object',
          properties: {
            type: { enum: ['class', 'method', 'function'] },
            filePath: { type: 'string' }
          }
        }
      },
      required: ['query']
    }
  },
  
  {
    name: 'code_memory_get_entity',
    description: 'Get detailed info about a specific code entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        includeRelations: { type: 'boolean', default: false }
      },
      required: ['entityId']
    }
  },

  {
    name: 'code_memory_update_purpose',
    description: 'Update the purpose/description of a code entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        purpose: { type: 'string' }
      },
      required: ['entityId', 'purpose']
    }
  },

  {
    name: 'code_memory_track_file',
    description: 'Add a file to the memory system',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        autoUpdate: { type: 'boolean', default: true }
      },
      required: ['filePath']
    }
  }
];
5.2 Server Implementation
typescript// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class CodeMemoryMCPServer {
  private server: Server;
  private orchestrator: MemoryOrchestrator;

  constructor() {
    this.server = new Server(
      { name: 'code-memory-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.orchestrator = new MemoryOrchestrator(
      new TypeScriptParser(),
      new JSONMemoryStore('./memory-store'),
      new SemanticSearchEngine()
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler('tools/list', async () => ({ tools }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'code_memory_search':
          return this.handleSearch(args);
        
        case 'code_memory_get_entity':
          return this.handleGetEntity(args);
          
        case 'code_memory_update_purpose':
          return this.handleUpdatePurpose(args);
          
        case 'code_memory_track_file':
          return this.handleTrackFile(args);
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleSearch(args: any) {
    const results = await this.orchestrator.search(args.query, args.filters);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: results.map(r => ({
            entity: r.entity.name,
            type: r.entity.type,
            purpose: r.entity.purpose,
            file: r.entity.filePath,
            score: r.score
          })),
          totalFound: results.length
        }, null, 2)
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start server
const server = new CodeMemoryMCPServer();
server.run().catch(console.error);

Advanced Features
6.1 Relationship Graph Visualization
typescript// src/graph/RelationshipMapper.ts
export class RelationshipMapper {
  buildCallGraph(projectData: any): CallGraph {
    const graph = {
      nodes: [],
      edges: []
    };

    // Build nodes
    for (const file of Object.values(projectData.files)) {
      for (const entity of Object.values(file.entities)) {
        graph.nodes.push({
          id: entity.id,
          label: entity.name,
          type: entity.type
        });

        // Build edges from relations
        if (entity.relations?.calls) {
          for (const calledMethod of entity.relations.calls) {
            graph.edges.push({
              from: entity.id,
              to: this.resolveMethodId(calledMethod),
              type: 'calls'
            });
          }
        }
      }
    }

    return graph;
  }

  findImpactedEntities(entityId: string, graph: CallGraph): string[] {
    // Find all entities that depend on this entity
    const impacted = new Set<string>();
    const queue = [entityId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = graph.edges
        .filter(e => e.to === current)
        .map(e => e.from);

      for (const dep of dependents) {
        if (!impacted.has(dep)) {
          impacted.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(impacted);
  }
}
6.2 Auto-Documentation from Code
typescript// src/documentation/AutoDocumenter.ts
export class AutoDocumenter {
  async generatePurpose(entity: ParsedEntity, context: CodeContext): Promise<string> {
    // Use Claude API to generate purpose from code
    const prompt = `
      Analyze this ${entity.type} and provide a concise purpose (1-2 sentences):
      
      Name: ${entity.name}
      Signature: ${entity.signature}
      Code Context:
      ${context.codeSnippet}
      
      Related entities: ${context.relatedEntities.join(', ')}
    `;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text.trim();
  }
}

Performance Metrics (Expected)
MetricOld SystemNew SystemImprovementSearch Latency2-5s50-200ms10-25x fasterToken Usage (Query)5,000-15,000100-50030x reductionCost per 1000 Queries$15-$50$0.50-$225x cheaperSearch Accuracy40%85%+2x betterUpdate Time30-60s1-5s10x faster

Migration Strategy
Phase 1: Parallel Run (Week 1-2)

Run new system alongside old
Compare results, tune parameters
No user-facing changes

Phase 2: Gradual Rollout (Week 3-4)

Enable for 10% of projects
Monitor error rates, performance
Gather user feedback

Phase 3: Full Migration (Week 5-6)

Migrate all projects
Archive old markdown files
Deprecate old MCP tools


Testing Strategy
typescript// tests/integration/search.test.ts
describe('SemanticSearchEngine', () => {
  it('should find method by natural language query', async () => {
    const engine = new SemanticSearchEngine(mockStore);
    
    const results = await engine.searchByContext({
      naturalQuery: 'What calculates product discounts?'
    });

    expect(results[0].entity.name).toBe('calculateDiscount');
    expect(results[0].score).toBeLessThan(0.3); // High relevance
  });

  it('should handle partial updates efficiently', async () => {
    const updater = new IncrementalUpdater(parser, store);
    
    // Modify only one method
    await modifyFile('product.ts', { method: 'calculateDiscount', line: 50 });
    
    const result = await updater.updateFile('product.ts');
    
    expect(result.type).toBe('partial');
    expect(result.changes).toBe(1);
    expect(result.tokensUsed).toBeLessThan(500); // vs 5000+ for full reparse
  });
});

Deployment
bash# Install dependencies
npm install fuse.js @babel/parser @babel/traverse diff

# Build
npm run build

# Configure MCP in Claude Desktop
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
json{
  "mcpServers": {
    "code-memory": {
      "command": "node",
      "args": ["/path/to/build/mcp/server.js"],
      "env": {
        "MEMORY_STORE_PATH": "/path/to/memory-store"
      }
    }
  }
}

Future Enhancements

Multi-language Support: Python, Rust, Go parsers
Vector Search: Embed code for semantic similarity
AI-Powered Refactoring: Suggest improvements based on patterns
Real-time Sync: Watch files and update memory instantly
Team Collaboration: Shared memory across team members


This architecture follows SOLID principles, scales efficiently, and solves all the problems identified in the original prompt. Ready to implement!i think you had missing one thing is like it could support 50000 words for the single method i dont have any problem with it, it could be handle more context not like the confusion small words context, more confusion would be there for the funcitonality it selg17:22Enhanced Plan: Deep Context Memory System
You're absolutely right! I missed a critical requirement. Let me refactor the architecture to handle MASSIVE context (50,000+ words per method) while maintaining clarity and searchability.
The Real Problem I Missed
Current Issue: Short summaries lose critical context

"Calculates discount" → But HOW? What edge cases? What business rules?
Agent gets confused without full context
More tokens needed for follow-up questions

Your Vision: Store COMPLETE context so agent understands deeply in ONE read

Full method implementation details
Business logic explanations
Edge cases and why they exist
Historical context of changes
Related domain knowledge


Revised Architecture: Hierarchical Context Storage
Core Principle: "Context Layers"
Store information at multiple granularity levels so agents can:

Quick scan (100 words) - What is it?
Deep dive (5,000 words) - How does it work?
Complete understanding (50,000 words) - Why every decision was made?


Enhanced Data Model
typescript// src/models/CodeEntity.ts

export interface CodeEntity {
  // Identity
  id: string;
  type: 'class' | 'method' | 'function' | 'module';
  name: string;
  filePath: string;
  lineRange: [number, number];
  
  // Multi-Layer Context (THIS IS THE KEY!)
  context: {
    // Layer 1: Quick Summary (50-200 words)
    summary: {
      purpose: string;              // "What does this do?"
      keyBehavior: string;           // "Main functionality in one line"
      primaryUseCase: string;        // "When should this be called?"
    };
    
    // Layer 2: Detailed Explanation (1,000-5,000 words)
    detailed: {
      implementation: string;        // How it's implemented
      algorithm: string;             // Algorithm used (if complex)
      dependencies: string[];        // What it depends on and why
      outputs: string;               // What it returns and why
      sideEffects: string;           // What else it modifies
      errorHandling: string;         // How it handles failures
      performance: string;           // Time/space complexity
    };
    
    // Layer 3: Deep Context (5,000-50,000+ words) - THE MISSING PIECE!
    deepContext: {
      businessLogic: {
        domain: string;              // Business domain explanation
        rules: string[];             // All business rules with examples
        edgeCases: string[];         // Every edge case with rationale
        assumptions: string[];       // Assumptions made and why
      };
      
      implementation: {
        fullExplanation: string;     // Line-by-line walkthrough
        designDecisions: string[];   // Why this approach vs alternatives
        tradeoffs: string[];         // What was sacrificed for what
        alternatives: string[];      // Other approaches considered
      };
      
      history: {
        evolution: string;           // How this code evolved over time
        majorChanges: ChangeLog[];   // Significant modifications with context
        bugs: BugHistory[];          // Past bugs and how they were fixed
        refactorings: string[];      // Past refactorings and lessons learned
      };
      
      relationships: {
        upstreamImpact: string;      // What breaks if this changes
        downstreamDeps: string;      // What this depends on deeply
        sharedConcepts: string[];    // Related concepts across codebase
      };
      
      domainKnowledge: {
        terminology: Record<string, string>;  // Domain-specific terms
        externalDocs: string[];      // Links to specs, RFCs, papers
        examples: Example[];         // Comprehensive usage examples
        antipatterns: string[];      // What NOT to do and why
      };
    };
  };
  
  // Searchable metadata
  metadata: {
    tags: string[];                  // Manual tags
    keywords: string[];              // Extracted keywords
    semanticEmbedding?: number[];    // Vector for semantic search
    complexity: number;              // Cyclomatic complexity
    importance: number;              // How critical is this code
  };
}

interface ChangeLog {
  date: string;
  author: string;
  reason: string;                    // Why change was made
  impact: string;                    // What was affected
  fullContext: string;               // Deep explanation (5,000+ words)
}

interface BugHistory {
  date: string;
  description: string;
  rootCause: string;                 // Deep analysis
  fix: string;                       // How it was fixed
  prevention: string;                // How to prevent in future
  fullContext: string;               // Complete investigation story
}

interface Example {
  scenario: string;
  input: string;
  output: string;
  explanation: string;               // Can be 1,000+ words
  commonMistakes: string[];
}

Smart Context Retrieval Strategy
The Agent Doesn't Read Everything at Once!
typescript// src/retrieval/ContextRetriever.ts

export class ContextRetriever {
  constructor(
    private store: IMemoryStore,
    private searchEngine: ISearchEngine
  ) {}

  /**
   * Progressive context loading based on agent's needs
   */
  async getContext(
    entityId: string,
    depth: 'summary' | 'detailed' | 'deep' = 'summary'
  ): Promise<RetrievedContext> {
    const entity = await this.store.get(entityId);
    
    switch (depth) {
      case 'summary':
        // ~200 words - quick overview
        return {
          tokenCount: ~200,
          content: entity.context.summary
        };
        
      case 'detailed':
        // ~2,000 words - implementation details
        return {
          tokenCount: ~2000,
          content: {
            ...entity.context.summary,
            ...entity.context.detailed
          }
        };
        
      case 'deep':
        // ~20,000+ words - everything!
        return {
          tokenCount: ~20000,
          content: entity.context  // ALL context layers
        };
    }
  }

  /**
   * Intelligent context assembly based on query
   */
  async getContextForQuery(query: string): Promise<AssembledContext> {
    // Parse query intent
    const intent = this.parseIntent(query);
    
    // Example: "Why does calculateDiscount use a Map instead of Array?"
    if (intent.type === 'design-decision') {
      return {
        primary: await this.getContext(intent.entityId, 'detailed'),
        supplementary: {
          designDecisions: entity.context.deepContext.implementation.designDecisions,
          alternatives: entity.context.deepContext.implementation.alternatives,
          tradeoffs: entity.context.deepContext.implementation.tradeoffs
        },
        totalTokens: ~3000  // Only what's needed
      };
    }
    
    // Example: "How has calculateDiscount changed over time?"
    if (intent.type === 'history') {
      return {
        primary: await this.getContext(intent.entityId, 'summary'),
        supplementary: {
          evolution: entity.context.deepContext.history.evolution,
          majorChanges: entity.context.deepContext.history.majorChanges
        },
        totalTokens: ~5000
      };
    }
    
    // Example: "Explain everything about calculateDiscount"
    if (intent.type === 'complete-understanding') {
      return {
        primary: await this.getContext(intent.entityId, 'deep'),
        supplementary: await this.getRelatedEntities(intent.entityId),
        totalTokens: ~25000  // Large but comprehensive
      };
    }
  }

  private parseIntent(query: string): QueryIntent {
    // Use keywords to determine what context is needed
    const intents = {
      'why': 'design-decision',
      'how': 'implementation',
      'changed': 'history',
      'edge case': 'edge-cases',
      'everything': 'complete-understanding',
      'explain': 'detailed',
      'bug': 'bug-history'
    };
    
    for (const [keyword, intent] of Object.entries(intents)) {
      if (query.toLowerCase().includes(keyword)) {
        return { type: intent, entityId: this.extractEntityId(query) };
      }
    }
    
    return { type: 'summary', entityId: this.extractEntityId(query) };
  }
}

Context Capture Tools
Tool 1: AI-Assisted Context Documentation
typescript// src/documentation/ContextCapturer.ts

export class ContextCapturer {
  /**
   * Generate MASSIVE context documentation using Claude API
   */
  async captureDeepContext(
    entity: ParsedEntity,
    codeContext: string
  ): Promise<DeepContext> {
    
    // Step 1: Generate business logic explanation (5,000 words)
    const businessLogic = await this.generateBusinessContext(entity, codeContext);
    
    // Step 2: Generate implementation walkthrough (10,000 words)
    const implementation = await this.generateImplementationContext(entity, codeContext);
    
    // Step 3: Generate design decisions (5,000 words)
    const designDecisions = await this.generateDesignContext(entity, codeContext);
    
    // Step 4: Generate domain knowledge (5,000 words)
    const domainKnowledge = await this.generateDomainContext(entity, codeContext);
    
    return {
      businessLogic,
      implementation,
      history: { evolution: '', majorChanges: [], bugs: [], refactorings: [] },
      relationships: { upstreamImpact: '', downstreamDeps: '', sharedConcepts: [] },
      domainKnowledge,
      totalWords: 25000
    };
  }

  private async generateBusinessContext(
    entity: ParsedEntity,
    code: string
  ): Promise<BusinessLogic> {
    const prompt = `
You are analyzing this ${entity.type}: ${entity.name}

Code:
\`\`\`typescript
${code}
\`\`\`

Generate a COMPREHENSIVE business logic explanation (target: 5,000 words). Include:

1. **Domain Context** (1,000 words)
   - What business problem does this solve?
   - What domain concepts are involved?
   - What are the real-world entities this models?

2. **Business Rules** (2,000 words)
   - List EVERY business rule implemented
   - For each rule, explain:
     * Why it exists
     * What happens if violated
     * Examples of valid/invalid scenarios
     * Historical context (was this always the rule?)

3. **Edge Cases** (1,500 words)
   - List EVERY edge case handled
   - For each edge case:
     * What triggers it
     * Why it's handled this way
     * Real-world example
     * What would break if not handled

4. **Assumptions** (500 words)
   - What assumptions does this code make?
   - Are they documented elsewhere?
   - What happens if assumptions are violated?

Be EXTREMELY detailed. Prefer 10,000 words over 5,000 if needed.
`;

    const response = await this.callClaude(prompt, 16000); // Large max_tokens
    
    return this.parseBusinessLogicResponse(response);
  }

  private async generateImplementationContext(
    entity: ParsedEntity,
    code: string
  ): Promise<ImplementationDetails> {
    const prompt = `
Analyze this implementation line-by-line:

\`\`\`typescript
${code}
\`\`\`

Generate EXHAUSTIVE implementation documentation (target: 10,000 words):

1. **Full Walkthrough** (5,000 words)
   - Go through the code line by line
   - Explain what each section does
   - Explain why each line is necessary
   - Point out non-obvious logic
   - Highlight clever tricks or gotchas

2. **Design Decisions** (3,000 words)
   - Why was this approach chosen?
   - What alternatives were considered?
   - What are the tradeoffs of this approach?
   - What would need to change if requirements changed?
   - What patterns/principles are being followed?

3. **Performance Analysis** (1,000 words)
   - Time complexity analysis
   - Space complexity analysis
   - Bottlenecks and optimization opportunities
   - Scalability considerations

4. **Error Handling** (1,000 words)
   - What errors are handled and how?
   - What errors are NOT handled and why?
   - Recovery strategies
   - Logging and debugging considerations

Be EXTREMELY thorough. More detail is better.
`;

    const response = await this.callClaude(prompt, 16000);
    
    return this.parseImplementationResponse(response);
  }

  private async callClaude(prompt: string, maxTokens: number): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  }
}

Chunked Storage for Massive Context
typescript// src/storage/ChunkedMemoryStore.ts

export class ChunkedMemoryStore implements IMemoryStore {
  /**
   * Store large context in chunks to avoid memory issues
   */
  async save(key: string, entity: CodeEntity): Promise<void> {
    // Save base entity
    await this.saveBase(key, {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      filePath: entity.filePath,
      context: {
        summary: entity.context.summary,
        detailed: entity.context.detailed
      }
    });

    // Save deep context in separate chunks
    if (entity.context.deepContext) {
      await this.saveChunk(`${key}/deep/business`, entity.context.deepContext.businessLogic);
      await this.saveChunk(`${key}/deep/implementation`, entity.context.deepContext.implementation);
      await this.saveChunk(`${key}/deep/history`, entity.context.deepContext.history);
      await this.saveChunk(`${key}/deep/relationships`, entity.context.deepContext.relationships);
      await this.saveChunk(`${key}/deep/domain`, entity.context.deepContext.domainKnowledge);
    }
  }

  async get(key: string, depth: 'base' | 'full' = 'base'): Promise<CodeEntity> {
    const base = await this.loadBase(key);
    
    if (depth === 'base') {
      return base;
    }

    // Load all deep context chunks
    const deepContext = {
      businessLogic: await this.loadChunk(`${key}/deep/business`),
      implementation: await this.loadChunk(`${key}/deep/implementation`),
      history: await this.loadChunk(`${key}/deep/history`),
      relationships: await this.loadChunk(`${key}/deep/relationships`),
      domainKnowledge: await this.loadChunk(`${key}/deep/domain`)
    };

    return { ...base, context: { ...base.context, deepContext } };
  }

  private async saveChunk(key: string, data: any): Promise<void> {
    const compressed = this.compress(JSON.stringify(data));
    await fs.writeFile(this.getPath(key), compressed);
  }

  private compress(data: string): Buffer {
    return zlib.gzipSync(Buffer.from(data));
  }
}

Enhanced MCP Tools
typescript// src/mcp/tools.ts

export const enhancedTools = [
  {
    name: 'code_memory_get_context',
    description: 'Get code context at different depths (summary/detailed/deep)',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        depth: {
          type: 'string',
          enum: ['summary', 'detailed', 'deep'],
          description: 'summary=200 words, detailed=2k words, deep=20k+ words'
        },
        aspects: {
          type: 'array',
          items: {
            enum: ['business', 'implementation', 'history', 'domain', 'relationships']
          },
          description: 'Specific aspects of deep context to retrieve'
        }
      },
      required: ['entityId']
    }
  },

  {
    name: 'code_memory_search_with_context',
    description: 'Search code and get appropriate context based on query intent',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query (e.g., "Why does X use Y instead of Z?")'
        },
        maxTokens: {
          type: 'number',
          default: 5000,
          description: 'Maximum context tokens to return'
        }
      },
      required: ['query']
    }
  },

  {
    name: 'code_memory_capture_context',
    description: 'Generate comprehensive documentation for a code entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        targetWords: {
          type: 'number',
          default: 10000,
          description: 'Target documentation length (can be 50,000+)'
        },
        includeAspects: {
          type: 'array',
          items: { enum: ['business', 'implementation', 'design', 'domain'] }
        }
      },
      required: ['entityId']
    }
  },

  {
    name: 'code_memory_explain_deeply',
    description: 'Get a COMPLETE explanation of a code entity (uses all context)',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        focus: {
          type: 'string',
          enum: ['everything', 'business-logic', 'implementation', 'design-decisions', 'history'],
          default: 'everything'
        }
      },
      required: ['entityId']
    }
  }
];

Usage Example: How Agent Uses This
typescript// Example 1: Agent needs quick info
await tools.code_memory_get_context({
  entityId: 'ProductService.calculateDiscount',
  depth: 'summary'
});
// Returns: ~200 words
// Cost: ~$0.002

// Example 2: Agent needs to understand implementation
await tools.code_memory_get_context({
  entityId: 'ProductService.calculateDiscount',
  depth: 'detailed'
});
// Returns: ~2,000 words
// Cost: ~$0.02

// Example 3: Agent needs COMPLETE understanding
await tools.code_memory_explain_deeply({
  entityId: 'ProductService.calculateDiscount',
  focus: 'everything'
});
// Returns: ~25,000 words (business logic, implementation, design, history, domain)
// Cost: ~$0.25
// BUT: Agent now has COMPLETE understanding in ONE read!

// Example 4: Intelligent query-based retrieval
await tools.code_memory_search_with_context({
  query: 'Why does calculateDiscount use a Map for discount tiers instead of a simple switch statement?',
  maxTokens: 5000
});
// System detects "why" + "instead of" = design decision query
// Returns: design decisions + alternatives + tradeoffs (~3,000 words)
// Cost: ~$0.03
// Agent gets EXACTLY what it needs!

Manual Context Enrichment Interface
typescript// src/cli/context-editor.ts

/**
 * Interactive CLI for developers to add deep context
 */
export class ContextEditor {
  async enrichEntity(entityId: string): Promise<void> {
    const entity = await this.store.get(entityId);
    
    console.log(`\nEnriching: ${entity.name}\n`);
    
    // Guided prompts
    const businessLogic = await this.promptLong(
      'Explain the business logic (be as detailed as needed - 5,000+ words is fine):'
    );
    
    const designDecisions = await this.promptLong(
      'Why did you implement it this way? What alternatives did you consider?'
    );
    
    const edgeCases = await this.promptList(
      'List all edge cases (press Enter twice to finish):'
    );
    
    const domainTerms = await this.promptDict(
      'Define domain-specific terms used in this code:'
    );

    // Save enriched context
    await this.store.update(entityId, {
      'context.deepContext.businessLogic': {
        domain: businessLogic,
        edgeCases: edgeCases
      },
      'context.deepContext.implementation.designDecisions': [designDecisions],
      'context.deepContext.domainKnowledge.terminology': domainTerms
    });

    console.log('\n✓ Context enriched! Agent will now have deep understanding.\n');
  }

  private async promptLong(question: string): Promise<string> {
    // Opens editor for long-form text
    const tmpFile = '/tmp/context-input.md';
    await fs.writeFile(tmpFile, `# ${question}\n\nWrite as much as needed...\n`);
    execSync(`${process.env.EDITOR || 'vim'} ${tmpFile}`);
    return await fs.readFile(tmpFile, 'utf-8');
  }
}

Search Enhancement: Semantic + Keyword Hybrid
typescript// src/search/HybridSearchEngine.ts

export class HybridSearchEngine {
  constructor(
    private fuzzySearch: Fuse<any>,
    private vectorSearch: VectorDB  // Optional: for semantic search
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    // Run both searches in parallel
    const [fuzzyResults, semanticResults] = await Promise.all([
      this.fuzzySearch.search(query),
      this.vectorSearch?.search(query) || []
    ]);

    // Merge and rank results
    const merged = this.mergeResults(fuzzyResults, semanticResults);
    
    // For each result, determine optimal context depth
    return merged.map(result => ({
      ...result,
      recommendedDepth: this.determineOptimalDepth(query, result.entity)
    }));
  }

  private determineOptimalDepth(query: string, entity: CodeEntity): ContextDepth {
    if (query.includes('everything') || query.includes('complete')) {
      return 'deep';
    }
    
    if (query.includes('how') || query.includes('implementation')) {
      return 'detailed';
    }
    
    return 'summary';
  }
}

Performance Optimization: Lazy Loading
typescript// src/retrieval/LazyContextLoader.ts

export class LazyContextLoader {
  /**
   * Load only what's accessed, not everything upfront
   */
  createProxy(entityId: string): CodeEntity {
    return new Proxy({} as CodeEntity, {
      get: (target, prop) => {
        // Load base info immediately
        if (!target.id) {
          Object.assign(target, this.loadBase(entityId));
        }

        // Load deep context only when accessed
        if (prop === 'deepContext' && !target.context.deepContext) {
          target.context.deepContext = this.loadDeepContext(entityId);
        }

        return target[prop];
      }
    });
  }

  private async loadDeepContext(entityId: string): Promise<DeepContext> {
    // Load from chunked storage only when needed
    return this.store.get(`${entityId}/deep`, 'full');
  }
}

Key Improvements Over Original Plan
AspectOriginal PlanEnhanced PlanContext Size100-500 words50,000+ words per entityContext DepthSingle summary3 layers (summary/detailed/deep)RetrievalAlways load everythingLoad only what's neededStorageSingle JSON fileChunked + compressedSearch IntelligenceKeywords onlyIntent-based context assemblyDocumentationManual onlyAI-assisted + manual enrichmentToken UsageFixed per queryAdaptive based on query intent

Complete Workflow Example
bash# 1. Developer writes new complex method
# file: src/pricing/discount-calculator.ts
function calculateTieredDiscount(order: Order): number {
  // 150 lines of complex business logic
  // Multiple edge cases
  // Historical context about why certain rules exist
}

# 2. Capture initial context automatically
$ code-memory track src/pricing/discount-calculator.ts --auto-document

# System:
# - Parses code structure ✓
# - Generates 10,000-word explanation using Claude ✓
# - Creates summary (200 words) ✓
# - Creates detailed explanation (2,000 words) ✓
# - Creates deep context (10,000 words) ✓

# 3. Developer enriches with manual context
$ code-memory enrich calculateTieredDiscount

# Prompts:
# - "Explain business rules in detail" → Developer writes 5,000 words
# - "List all edge cases" → Developer adds 20 edge cases with examples
# - "Why this approach vs alternatives?" → Developer explains tradeoffs

# Total context: ~20,000 words stored

# 4. Agent uses it efficiently
Agent Query: "What does calculateTieredDiscount do?"
→ Returns 200-word summary
→ Cost: $0.002

Agent Query: "How is calculateTieredDiscount implemented?"
→ Returns 2,000-word detailed explanation
→ Cost: $0.02

Agent Query: "Explain EVERYTHING about calculateTieredDiscount including all business rules, edge cases, and why it's implemented this way"
→ Returns ALL 20,000 words of context
→ Cost: $0.20
→ Agent now has COMPLETE understanding!

Agent Query: "Why does calculateTieredDiscount check inventory status?"
→ System detects design-decision intent
→ Returns only relevant sections (~3,000 words)
→ Cost: $0.03

Summary: Why This Works

No Context Loss: Store 50,000+ words - nothing is "summarized away"
Efficient Retrieval: Agent only reads what it needs via intelligent intent detection
Complete Understanding: When needed, agent can get EVERYTHING in one read
Cost Effective: Most queries use summary (cheap), deep dives are rare but powerful
Developer-Friendly: AI generates initial docs, developers enhance with business context
Scalable: Chunked storage handles massive codebases

The key insight: More context is BETTER, but only when retrieved intelligently based on query intent!