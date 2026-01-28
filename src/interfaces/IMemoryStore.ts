export interface CodeEntity {
  // Identity
  id: string;
  type: 'class' | 'method' | 'function' | 'module';
  name: string;
  filePath: string;
  lineRange: [number, number];
  
  // Multi-Layer Context
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
    
    // Layer 3: Deep Context (5,000-50,000+ words)
    deepContext?: {
      businessLogic?: {
        domain: string;              // Business domain explanation
        rules: string[];             // All business rules with examples
        edgeCases: string[];         // Every edge case with rationale
        assumptions: string[];       // Assumptions made and why
      };
      
      implementation?: {
        fullExplanation: string;     // Line-by-line walkthrough
        designDecisions: string[];   // Why this approach vs alternatives
        tradeoffs: string[];         // What was sacrificed for what
        alternatives: string[];      // Other approaches considered
      };
      
      history?: {
        evolution: string;           // How this code evolved over time
        majorChanges?: { date: string; changes: string }[];   // Significant modifications with context
        bugs?: { date: string; description: string; fix: string }[];          // Past bugs and how they were fixed
        refactorings?: string[];      // Past refactorings and lessons learned
      };
      
      relationships?: {
        upstreamImpact: string;      // What breaks if this changes
        downstreamDeps: string;      // What this depends on deeply
        sharedConcepts: string[];    // Related concepts across codebase
      };
    };
  };

  // Additional metadata mostly for the search engine or graph
  metadata?: {
      lastModified: string;
      hash: string;
      imports?: string[];
  }
}

export interface SearchFilters {
    type?: 'class' | 'method' | 'function';
    filePath?: string;
}

export interface SearchResult {
    entity: CodeEntity;
    score: number;
    highlights?: any;
}

export interface IMemoryStore {
  save(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>; // Careful with strict typing until we have a discriminated union or generic
  update(key: string, partialUpdate: Partial<any>): Promise<void>;
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
}
