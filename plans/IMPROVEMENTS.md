# IMPROVEMENTS.md - Prioritized Improvement Suggestions

## Priority 1: Critical / High Impact

### 1.1 Replace MemoryStorage with Persistent Storage
**Current**: `MemoryStorage` in `index.ts` loses all state on restart.
**Improvement**: Switch to `CosmosDbPartitionedStorage`, `BlobsStorage`, or Redis for production persistence.
**Impact**: Data durability in production, multi-instance support.

### 1.2 Add Input Validation on Solver API Responses
**Current**: `solverService.ts` trusts `json.data.board` and `json.data.hints` without null checks on nested properties.
**Improvement**: Validate response shape before accessing nested fields; add defensive checks for `steps`, `technique`, and `board.user`.
**Impact**: Prevents runtime crashes from unexpected API responses.

### 1.3 Add Rate Limiting
**Current**: No rate limiting on `/api/messages` or internal solver API calls.
**Improvement**: Add per-user rate limiting (e.g., max 10 hints/minute) and global rate limiting on solver calls.
**Impact**: Prevents abuse and protects the solver API from overload.

## Priority 2: Important / Moderate Impact

### 2.1 Add End-to-End Integration Tests
**Current**: Only unit tests exist. No integration tests for dialog flows.
**Improvement**: Use Bot Framework `TestAdapter` to simulate multi-turn conversations (upload -> confirm -> hint -> apply).
**Impact**: Catch dialog flow regressions.

### 2.2 Add Image Caching for Rendered Boards
**Current**: Board is re-rendered from scratch each time (50-100ms per render).
**Improvement**: Cache rendered board images keyed by `(original, user, hintStep)` hash. Use LRU cache with TTL.
**Impact**: Reduced latency for repeated hint step navigation.

### 2.3 Add Proactive Error Recovery
**Current**: Errors in `handleImageUpload`, `handleGetHint`, `handleApplyHint` all return generic error messages.
**Improvement**: Differentiate between network errors, solver errors, OCR errors, and validation errors. Provide specific recovery suggestions.
**Impact**: Better user experience when things go wrong.

### 2.4 Add Structured Logging
**Current**: Uses `console.log()` and `console.error()` for all logging.
**Improvement**: Integrate a structured logger (e.g., `pino`) with log levels, request context, and correlation IDs.
**Impact**: Better observability in production, easier debugging.

### 2.5 Extract Inline Adaptive Cards to Templates
**Current**: `mainDialog.ts` contains large inline Adaptive Card JSON objects (~50 lines each) in `handleApplyHint()` and `handleShowProgress()`.
**Improvement**: Move these to `src/cards/` alongside existing card builders. Create `createAppliedHintCard()` and `createProgressBoardCard()`.
**Impact**: Cleaner dialog code, consistent card patterns, easier card customization.

## Priority 3: Nice to Have / Low Impact

### 3.1 Add User Profile Tracking
**Current**: `SudokuUserData` interface exists in `conversationState.ts` with `puzzlesSolved` and `hintsUsed`, but it is never used.
**Improvement**: Increment counters in `handleApplyHint()` and when puzzle is complete. Display stats in a profile card.
**Impact**: User engagement and gamification.

### 3.2 Add Puzzle History
**Current**: Only one puzzle at a time, no history.
**Improvement**: Store completed puzzles in user state. Add a "history" command showing past puzzles and techniques used.
**Impact**: Learning tool - users can see which techniques they have encountered.

### 3.3 Add `bun run verify` Script
**Current**: No unified verification command. Separate `typecheck`, `lint`, `test`, `build` scripts.
**Improvement**: Add `"verify": "bun run typecheck && bun run lint && bun run test && bun run build"` to match ecosystem conventions.
**Impact**: Consistency with other Sudobility projects.

### 3.4 Add Graceful Shutdown
**Current**: No cleanup on `SIGTERM`/`SIGINT`.
**Improvement**: Add signal handlers to close the Restify server and flush state.
**Impact**: Clean shutdown in containerized environments.

### 3.5 Support Puzzle Input via Text
**Current**: Puzzles can only be loaded via image upload.
**Improvement**: Allow users to paste an 81-character puzzle string directly. Validate and load.
**Impact**: Faster workflow for users who already have the puzzle digitized.
