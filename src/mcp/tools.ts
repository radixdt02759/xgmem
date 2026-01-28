/**
 * MCP Code Memory Tools
 * 
 * These tools help agents understand, document, and search code entities.
 * Each tool includes detailed relations, usage context, sequence order, and validation requirements.
 */

// Tool Sequence Order:
// 1. code_memory_track_file - FIRST: Index files before any other operations
// 2. code_memory_search - SECOND: Find entities after tracking files
// 3. code_memory_save - THIRD: Save documentation for found entities

export const codeMemoryTools = [
  {
    name: 'code_memory_track_file',
    description: `Parse a TypeScript/JavaScript file and store its structure (classes, methods, functions) in memory for fast lookup.

## SEQUENCE ORDER: 1 (ALWAYS USE FIRST)
This tool MUST be called BEFORE using code_memory_search or code_memory_save.

## WHEN TO USE:
- At the START of any code analysis session
- When you need to understand a new file's structure
- Before documenting any code entity
- When the file has been modified and needs re-indexing

## RELATIONS:
→ PRECEDES: code_memory_search (must track file before searching)
→ PRECEDES: code_memory_save (must track file before saving documentation)
→ ENABLES: All other code memory operations for this file

## WORKFLOW EXAMPLE:
1. Agent receives task: "Document the UserService class"
2. FIRST: Track the file → code_memory_track_file({ filePath: "/path/to/UserService.ts" })
3. THEN: Search for entity → code_memory_search({ query: "UserService" })
4. FINALLY: Save documentation → code_memory_save({ entityId: "UserService", purpose: "..." })

## VALIDATION REQUIREMENTS:
- filePath: MUST be an absolute path (starting with /)
- filePath: MUST point to a valid .ts or .js file
- filePath: File MUST exist on the filesystem`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { 
          type: 'string',
          description: 'REQUIRED. Absolute path to the TypeScript/JavaScript file to index. Must start with "/" and end with .ts or .js extension.',
          pattern: '^/.*\\.(ts|js)$',
          minLength: 5
        }
      },
      required: ['filePath'],
      additionalProperties: false
    }
  },

  {
    name: 'code_memory_search',
    description: `Search stored code entities by name or purpose. Use to find what a method/class does without reading the file.

## SEQUENCE ORDER: 2 (USE AFTER TRACKING)
This tool should be used AFTER code_memory_track_file has indexed the relevant files.

## WHEN TO USE:
- To find existing code entities before documenting them
- To check if documentation already exists for an entity
- To locate code entities by name or description
- To verify entity names before using code_memory_save

## RELATIONS:
← FOLLOWS: code_memory_track_file (files must be tracked first)
→ PRECEDES: code_memory_save (search to get correct entityId before saving)
→ RETURNS: Entity information needed for code_memory_save

## WORKFLOW EXAMPLE:
1. After tracking files, search for the entity you want to document
2. code_memory_search({ query: "calculateTotal" })
3. Review results to get the exact entity name and current documentation status
4. Use the returned entity name for code_memory_save

## VALIDATION REQUIREMENTS:
- query: MUST be at least 2 characters
- query: Should be a meaningful search term (entity name, keyword, or description)
- query: Can search by name, type, or purpose/description`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'REQUIRED. Search query to find code entities. Can be: entity name (e.g., "UserService"), function name (e.g., "calculateTotal"), or descriptive keywords (e.g., "authentication handler"). Minimum 2 characters.',
          minLength: 2,
          maxLength: 200
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  
  {
    name: 'code_memory_save',
    description: `Save comprehensive documentation for a code entity. REQUIRED: Provide meaningful explanation of what the code does, how it works, and why.

## SEQUENCE ORDER: 3 (USE LAST - AFTER TRACKING AND SEARCHING)
This tool should be used AFTER:
1. code_memory_track_file has indexed the file containing the entity
2. code_memory_search has verified the entity exists and retrieved its exact name

## WHEN TO USE:
- AFTER analyzing code in depth and understanding its purpose
- AFTER tracking the file and searching for the entity
- When you have comprehensive knowledge about the code's behavior
- When documenting classes, functions, methods, or modules

## RELATIONS:
← FOLLOWS: code_memory_track_file (entity must be tracked first)
← FOLLOWS: code_memory_search (confirm entity exists before documenting)
→ UPDATES: Knowledge base with detailed documentation
→ ENABLES: Future agents to understand code without reading files

## WORKFLOW EXAMPLE:
1. Track file: code_memory_track_file({ filePath: "/src/services/PaymentService.ts" })
2. Search: code_memory_search({ query: "PaymentService" })
3. Read the actual code to understand it deeply
4. Save documentation: code_memory_save({
     entityId: "PaymentService",
     filePath: "/src/services/PaymentService.ts",
     purpose: "Handles all payment processing operations including Stripe integration..."
   })

## VALIDATION REQUIREMENTS:
- entityId: REQUIRED - Exact name of the entity (get from code_memory_search results)
- filePath: RECOMMENDED - Path where the entity exists (helps with disambiguation)
- purpose: REQUIRED - Comprehensive documentation (minimum 50 characters, recommended 200-5000 words)

## PURPOSE FIELD MUST INCLUDE:
1. WHAT: What does this code do? (high-level summary)
2. HOW: How does it work? (key steps, algorithm, flow)
3. DEPENDENCIES: What libraries, services, or other code does it use?
4. SIDE EFFECTS: What state does it modify? Database changes? External API calls?
5. WHY: Why does this code exist? Business context and purpose
6. INPUTS/OUTPUTS: What parameters does it accept? What does it return?
7. ERROR HANDLING: How does it handle errors? What exceptions can it throw?

## BAD EXAMPLES (WILL BE REJECTED):
❌ "Handles payments" - Too vague, no details
❌ "This is a service class" - Doesn't explain what it does
❌ "Processes user data" - No specifics about how

## GOOD EXAMPLE:
✅ "PaymentService handles all payment processing for the application. 

WHAT IT DOES: Processes credit card payments via Stripe, manages refunds, and tracks payment history.

HOW IT WORKS:
1. Receives payment request with amount and customer token
2. Validates the payment amount (must be > 0 and < max limit)
3. Calls Stripe API to create a PaymentIntent
4. Stores transaction record in PostgreSQL payments table
5. Emits 'payment.completed' event for webhook handlers
6. Returns transaction ID and confirmation

DEPENDENCIES:
- stripe: Stripe SDK for payment processing
- pg: PostgreSQL client for database operations
- EventEmitter: For publishing payment events

SIDE EFFECTS:
- Creates records in 'payments' and 'transactions' tables
- Makes external HTTP calls to Stripe API
- Emits events that trigger email notifications

ERROR HANDLING:
- Throws PaymentDeclinedError for declined cards
- Throws InsufficientFundsError for balance issues
- Logs all errors to monitoring service

BUSINESS CONTEXT: This is the core payment system used by the checkout flow and subscription management."`,
    inputSchema: {
      type: 'object',
      properties: {
        entityId: { 
          type: 'string',
          description: 'REQUIRED. Exact entity name as returned from code_memory_search (e.g., "ProductService", "calculateDiscount", "User.authenticate"). Must match an existing tracked entity.',
          minLength: 1,
          maxLength: 200
        },
        filePath: {
          type: 'string',
          description: 'RECOMMENDED. Absolute file path where this entity exists. Helps distinguish entities with the same name in different files. Should match the path used in code_memory_track_file.',
          pattern: '^/.*\\.(ts|js)$'
        },
        purpose: { 
          type: 'string',
          minLength: 50,
          maxLength: 10000,
          description: `REQUIRED. Comprehensive documentation explaining this code entity.

MINIMUM: 50 characters
RECOMMENDED: 200-5000 words

MUST INCLUDE ALL OF THE FOLLOWING:
1. WHAT: What does this code do? (high-level summary)
2. HOW: How does it work? (key steps, algorithm, logic flow)
3. DEPENDENCIES: What does it import/use? (libraries, other services, utilities)
4. SIDE EFFECTS: What state changes? (database writes, file I/O, API calls, events)
5. WHY: Why does this code exist? (business context, problem it solves)
6. INPUTS/OUTPUTS: Parameters accepted and values returned
7. ERROR HANDLING: How errors are handled, exceptions thrown

EXAMPLE FORMAT:
"[EntityName] handles [high-level purpose].

WHAT IT DOES: [Clear summary of functionality]

HOW IT WORKS:
1. [Step 1]
2. [Step 2]
3. [Step 3]

DEPENDENCIES:
- [library/service]: [how it's used]

SIDE EFFECTS:
- [Effect 1]
- [Effect 2]

ERROR HANDLING:
- [Error type]: [How handled]

BUSINESS CONTEXT: [Why this exists in the system]"`
        }
      },
      required: ['entityId', 'purpose'],
      additionalProperties: false
    }
  }
];

/**
 * Tool Relationship Diagram:
 * 
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │                    CODE MEMORY WORKFLOW                          │
 *  │                                                                  │
 *  │   ┌──────────────────────┐                                      │
 *  │   │  1. TRACK FILE       │ ◄── START HERE                       │
 *  │   │  code_memory_track   │                                      │
 *  │   │  _file               │                                      │
 *  │   └──────────┬───────────┘                                      │
 *  │              │                                                   │
 *  │              │ indexes entities                                  │
 *  │              ▼                                                   │
 *  │   ┌──────────────────────┐                                      │
 *  │   │  2. SEARCH           │                                      │
 *  │   │  code_memory_search  │ ◄── Find entities to document        │
 *  │   └──────────┬───────────┘                                      │
 *  │              │                                                   │
 *  │              │ returns entity names                              │
 *  │              ▼                                                   │
 *  │   ┌──────────────────────┐                                      │
 *  │   │  3. SAVE DOCS        │                                      │
 *  │   │  code_memory_save    │ ◄── Document with comprehensive info │
 *  │   └──────────────────────┘                                      │
 *  │                                                                  │
 *  └─────────────────────────────────────────────────────────────────┘
 * 
 * VALIDATION SUMMARY:
 * ┌─────────────────────┬────────────────────────────────────────────┐
 * │ Tool                │ Required Validations                       │
 * ├─────────────────────┼────────────────────────────────────────────┤
 * │ track_file          │ - Absolute path (starts with /)            │
 * │                     │ - Valid extension (.ts or .js)             │
 * │                     │ - File must exist                          │
 * ├─────────────────────┼────────────────────────────────────────────┤
 * │ search              │ - Query min 2 characters                   │
 * │                     │ - Query max 200 characters                 │
 * ├─────────────────────┼────────────────────────────────────────────┤
 * │ save                │ - entityId required (from search results)  │
 * │                     │ - purpose min 50 chars (recommended 200+)  │
 * │                     │ - purpose must include: what, how, deps,   │
 * │                     │   side effects, why, inputs/outputs, errors│
 * └─────────────────────┴────────────────────────────────────────────┘
 */
