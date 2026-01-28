export interface ParsedEntity {
  id: string;
  type: 'class' | 'function' | 'method' | 'variable';
  name: string;
  purpose?: string;
  lineRange: [number, number];
  signature?: string;
  filePath?: string; // Added for convenience in some contexts
}

export interface ParsedStructure {
  filePath: string;
  hash: string;
  entities: ParsedEntity[];
}

export interface ICodeParser {
  parseFile(filePath: string): Promise<ParsedStructure>;
  extractEntities(ast: any): ParsedEntity[];
}
