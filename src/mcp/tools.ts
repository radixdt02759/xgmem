export const codeMemoryTools = [
  {
    name: 'code_memory_track_file',
    description: 'Parse a TypeScript/JavaScript file and store its structure (classes, methods, functions) in memory for fast lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { 
          type: 'string',
          description: 'Absolute path to the file'
        }
      },
      required: ['filePath']
    }
  },

  {
    name: 'code_memory_search',
    description: 'Search stored code entities by name or purpose. Use to find what a method/class does without reading the file.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search query (name or description)' 
        }
      },
      required: ['query']
    }
  },
  
  {
    name: 'code_memory_save',
    description: 'Save or update documentation for a code entity. Use after understanding what code does.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { 
          type: 'string',
          description: 'Entity name (e.g., "ProductService" or "calculateDiscount")'
        },
        filePath: {
          type: 'string',
          description: 'File path where this entity exists'
        },
        purpose: { 
          type: 'string',
          description: 'What this code does (can be detailed - up to 50k words)'
        }
      },
      required: ['entityId', 'purpose']
    }
  }
];
