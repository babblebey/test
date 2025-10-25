# Product Requirements Document: MDX Content Review GitHub Action

**Version:** 1.0  
**Date:** October 25, 2025  
**Owner:** babblebey  
**Status:** Planning

---

## Executive Summary

Build a GitHub Action that automatically reviews Pull Requests containing MDX file additions or modifications. The action uses an LLM (Large Language Model) to rate content quality and provide actionable code suggestions directly within GitHub's PR review interface.

---

## Goals & Objectives

### Primary Goals
1. Automate quality review of MDX content contributions
2. Provide actionable, inline code suggestions using GitHub's native suggestion feature
3. Rate contributions on a consistent rubric via LLM
4. Reduce manual review burden for maintainers

### Success Criteria
- Action successfully runs on PRs with MDX changes
- Posts review comments with rating (1-5 scale) and reasoning
- Generates inline code suggestions that can be applied with one click
- Maintains sub-2-minute execution time for typical PRs (1-5 files)
- Zero exposure of secrets in logs

---

## Target Users

### Primary Users
- Repository maintainers who review MDX documentation contributions
- Contributors who submit MDX content and want quick feedback

### Use Cases
1. **New content submission**: Contributor adds new `.mdx` files for documentation/blog posts
2. **Content updates**: Contributor edits existing `.mdx` files to improve or fix content
3. **Bulk changes**: Multiple MDX files modified in a single PR (e.g., style updates)

---

## Functional Requirements

### FR-1: Trigger & Scope
- **FR-1.1**: Action triggers on `pull_request` events (opened, synchronize, reopened)
- **FR-1.2**: Action only processes PRs that include changes to `**/*.mdx` files
- **FR-1.3**: Action ignores PRs with label `ai-skip-review` (optional opt-out)

### FR-2: File Processing
- **FR-2.1**: Fetch list of changed files from PR
- **FR-2.2**: Filter for `.mdx` files only
- **FR-2.3**: Retrieve full file content for each MDX file
- **FR-2.4**: Handle up to 20 MDX files per PR (configurable limit)
- **FR-2.5**: For files >4000 tokens, truncate or send changed hunks only

### FR-3: LLM Integration
- **FR-3.1**: Send MDX content to LLM with pre-defined prompt template using AI SDK
- **FR-3.2**: Prompt includes:
  - File path
  - File content (or changed sections)
  - Review criteria (clarity, accuracy, structure, style, MDX syntax)
- **FR-3.3**: Request structured JSON response with schema using `generateObject` from AI SDK:
  ```json
  {
    "rating": 1-5,
    "summary": "string (max 500 chars)",
    "suggestions": [
      {
        "file": "path/to/file.mdx",
        "line_start": number,
        "line_end": number,
        "reason": "string",
        "suggestion": "replacement text"
      }
    ]
  }
  ```
- **FR-3.4**: Support multiple LLM providers via AI SDK (OpenAI, Anthropic, etc.)
- **FR-3.5**: Configurable provider, model, temperature, max_tokens via action inputs
- **FR-3.6**: Use Zod schema for structured output validation

### FR-4: Review Posting
- **FR-4.1**: Create GitHub PR review with overall rating and summary
- **FR-4.2**: For each suggestion, post a review comment with:
  - File path and line position
  - Inline code suggestion using GitHub's ` ```suggestion ` block
  - Reasoning for the suggestion
- **FR-4.3**: Review event type:
  - Rating 4-5: `COMMENT` or `APPROVE` (configurable threshold)
  - Rating 1-3: `REQUEST_CHANGES` or `COMMENT`
- **FR-4.4**: If LLM fails, post informational comment without blocking PR

### FR-5: Error Handling
- **FR-5.1**: Retry LLM requests with exponential backoff (3 attempts)
- **FR-5.2**: On parse failure, post safe fallback comment
- **FR-5.3**: On API rate limit, queue gracefully or skip with notice
- **FR-5.4**: Log errors to action output (without exposing secrets)

### FR-6: Configuration
- **FR-6.1**: Configurable via action inputs:
  - `api_key` (secret, required) - LLM provider API key
  - `provider` (default: `openai`) - AI SDK provider name
  - `model` (default: `gpt-4o-mini`)
  - `temperature` (default: `0.3`)
  - `max_tokens` (default: `2000`)
  - `approval_threshold` (default: `4`)
  - `max_files` (default: `20`)
  - `prompt_template` (optional override)
- **FR-6.2**: Read API key from GitHub secrets (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)

---

## Non-Functional Requirements

### NFR-1: Performance
- Process typical PR (5 MDX files) in under 2 minutes
- Parallel LLM requests when possible (rate limit aware)

### NFR-2: Security
- Never log API keys or secrets
- Sanitize file content to remove potential secrets before sending to LLM
- Use GitHub token with minimal permissions (`contents: read`, `pull-requests: write`)

### NFR-3: Cost Management
- Estimate token usage before sending to LLM
- Cap per-PR cost at ~$0.50 (configurable)
- Provide token usage summary in action logs

### NFR-4: Reliability
- 95% success rate for valid PRs
- Graceful degradation on LLM failures

### NFR-5: Maintainability
- TypeScript codebase with strong typing
- Unit test coverage >80%
- Integration tests with mocked GitHub/LLM APIs
- Clear inline documentation

---

## Technical Architecture

### Simplified Module Structure

The action lives as a self-contained module in the project at `actions/mdx-review/`.

#### 1. GitHub Workflow (`.github/workflows/mdx-review.yml`)
- Triggers on PR events
- Filters for MDX file changes
- Invokes the local action at `./actions/mdx-review`

#### 2. Action Module (`actions/mdx-review/`)
Contains two files:

**`action.yml`** - Action metadata
- Defines action inputs, outputs, and runtime
- Uses Node.js 20
- Specifies main entrypoint as `index.ts`

**`index.ts`** - Single-file implementation
- All logic in one file for simplicity
- Organized into logical sections:
  1. **Types & Interfaces** - TypeScript types for Review, Suggestion, File, etc.
  2. **Configuration** - Read action inputs and GitHub context
  3. **GitHub Functions** - Fetch files, post reviews (using Octokit)
  4. **LLM Functions** - Call AI SDK, build prompts, parse responses
  5. **Utility Functions** - Token counting, sanitization, validation
  6. **Main Orchestration** - Entry point that coordinates the flow
- Uses AI SDK (`ai` package) for LLM integration (provider-agnostic)
- Directly uses `@actions/core` and `@actions/github`

### Data Flow
```
PR Event → Workflow Trigger → Action Start
  ↓
Fetch Changed Files (GitHub API)
  ↓
Filter MDX Files → For Each File:
  ↓
Build Prompt → Send to LLM → Parse Response
  ↓
Aggregate Reviews → Post to GitHub
  ↓
Action Complete
```

### Dependencies
- `@actions/core` - GitHub Actions toolkit
- `@actions/github` - GitHub API client (Octokit)
- `ai` - Vercel AI SDK (provider-agnostic LLM interface)
- `@ai-sdk/openai` - OpenAI provider for AI SDK (or other providers as needed)
- `zod` - Runtime schema validation
- `typescript` - Type safety
- `vitest` - Testing framework (optional)

---

## Prompt Template Design

### Default Prompt Structure

**System Message:**
```
You are an expert documentation reviewer specializing in MDX content.
Evaluate content based on:
- Clarity: Is the writing clear and easy to understand?
- Accuracy: Are technical details correct?
- Structure: Is the content well-organized with proper headings and flow?
- Style: Does it follow best practices for technical documentation?
- MDX Syntax: Are MDX components used correctly?

Output ONLY valid JSON matching this schema:
{
  "rating": 1-5 (integer),
  "summary": "Brief explanation of rating (max 500 chars)",
  "suggestions": [
    {
      "file": "file path",
      "line_start": line number,
      "line_end": line number,
      "reason": "Why this change improves the content",
      "suggestion": "Exact replacement text for lines"
    }
  ]
}
```

**User Message Template:**
```
Review this MDX file:

**File:** {file_path}
**Content:**
```
{file_content}
```

Provide a rating (1-5) and specific suggestions for improvement.
Focus on actionable changes that enhance clarity, accuracy, and readability.
```

---

## GitHub Suggestion Format

### Single-line Suggestion
```markdown
**Clarity improvement:**

```suggestion
improved single line of text
```
```

### Multi-line Suggestion
```markdown
**Restructure paragraph for better flow:**

```suggestion
First improved line
Second improved line
Third improved line
```
```

---

## Implementation Phases

### Phase 1: Core Functionality (MVP)
- [x] Create `actions/mdx-review/` directory structure
- [x] Create `action.yml` with inputs/outputs definition
- [x] Create `index.ts` with all logic sections:
  - [x] Types and interfaces
  - [x] GitHub functions (fetch files, post reviews)
  - [x] LLM functions (AI SDK integration)
  - [x] Utility functions (sanitization, validation)
  - [x] Main orchestration
- [x] Create `package.json` with AI SDK dependencies
- [x] Create `tsconfig.json` for TypeScript configuration
- [x] Workflow YAML configuration in `.github/workflows/`
- [x] README with setup instructions

### Phase 2: Enhanced Features
- [ ] JSON schema validation with Zod
- [ ] Retry logic with exponential backoff
- [ ] Token counting and cost estimation
- [ ] Content sanitization (secret detection)
- [ ] Configurable inputs (model, temperature, etc.)
- [ ] Multiple file batching

### Phase 3: Testing & Documentation
- [ ] Unit tests (optional - prompt builder, response parser)
- [ ] Integration tests (optional - mocked GitHub/AI SDK)
- [ ] End-to-end test with real PR
- [ ] Comprehensive README in `actions/mdx-review/`
- [ ] Usage examples and troubleshooting guide

### Phase 4: Polish & Optimization
- [ ] Performance optimization (parallel requests)
- [ ] Enhanced error messages
- [ ] Action output summary with metrics
- [ ] Optional Slack/Discord notifications
- [ ] Support for alternative LLM providers

---

## Permissions & Security

### GitHub Token Permissions
```yaml
permissions:
  contents: read        # Read PR files
  pull-requests: write  # Post reviews and comments
```

### Secrets Required
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or other provider key - LLM API key (stored in repository secrets)
- Pass to action via the `api_key` input

### Security Measures
1. **Secret Masking**: Use `core.setSecret()` to mask keys in logs
2. **Content Sanitization**: Regex patterns to detect and remove:
   - API keys (pattern: `[A-Za-z0-9-_]{20,}`)
   - Tokens (pattern: `ghp_[A-Za-z0-9]{36}`)
   - Environment variables with sensitive names
3. **Minimal Permissions**: Only request necessary GitHub token scopes
4. **No Secret Logging**: Never log full file content or API responses containing user data

---

## Error Scenarios & Handling

| Scenario | Handling |
|----------|----------|
| LLM API timeout | Retry 3x with backoff, then post notice comment |
| Invalid JSON response | Log warning, post generic review without suggestions |
| Rate limit exceeded | Queue request or skip with informative comment |
| Large PR (>20 files) | Process first 20, note limitation in comment |
| File too large (>4000 tokens) | Truncate and send first 3000 tokens with note |
| GitHub API error | Retry once, then fail gracefully with error log |
| No MDX files changed | Skip action silently |
| PR has `ai-skip-review` label | Skip with info log |

---

## Testing Strategy

### Unit Tests
- **Prompt Builder**: Given file content → correct prompt structure
- **Response Parser**: Sample JSON responses → parsed Review objects
- **Token Counter**: File content → accurate token count
- **Sanitizer**: Content with secrets → sanitized version

### Integration Tests (Mocked)
- **GitHub Client**: Mock Octokit, verify correct API calls
- **LLM Client**: Mock OpenAI, verify request format and response handling
- **End-to-End**: Mock both, verify full flow from PR event to review post

### Manual Testing
- Create test repository
- Submit PR with MDX changes
- Verify action runs and posts review correctly

---

## Monitoring & Metrics

### Action Outputs
- Total files processed
- LLM tokens used
- Estimated cost
- Review rating
- Suggestions count
- Execution time

### Logs
- File processing progress
- LLM request/response (sanitized)
- GitHub API calls
- Errors and warnings

---

## Future Enhancements (Out of Scope for v1)

1. **Multi-LLM Support**: Switch between providers easily with AI SDK (already supports Claude, Gemini, etc.)
2. **Custom Rubrics**: Allow repos to define review criteria in config file
3. **Historical Analysis**: Track content quality trends over time
4. **Incremental Reviews**: Only review changed sections, not full files
5. **Auto-Apply Suggestions**: Automatically commit approved suggestions
6. **Learning Mode**: Improve prompts based on maintainer feedback
7. **Style Guide Integration**: Check against project-specific style guides
8. **Plagiarism Detection**: Check for copied content
9. **Readability Scores**: Calculate Flesch-Kincaid or similar metrics
10. **Multi-language Support**: Review non-English content

---

## Success Metrics

### Quantitative
- 90% of MDX PRs receive automated review within 2 minutes
- 70% of suggestions accepted by maintainers
- 50% reduction in manual review time
- <$1/month average LLM cost per active repository

### Qualitative
- Maintainers report improved PR quality
- Contributors appreciate fast feedback
- Reduces back-and-forth review cycles

---

## Dependencies & Prerequisites

### Required
- GitHub repository with MDX content
- OpenAI API account and key
- Node.js 20+ runtime in GitHub Actions

### Optional
- ACT for local workflow testing
- VS Code with GitHub Actions extension

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM hallucination/bad suggestions | Medium | Medium | Include disclaimer in review; human approval required |
| API cost overrun | Low | Medium | Implement per-PR cost cap; token budgeting |
| Rate limiting | Low | Low | Exponential backoff; queue requests |
| Security: secret exposure | Low | High | Sanitization; strict logging policy |
| Large PR overwhelms action | Medium | Low | File count limit; timeout protection |

---

## Open Questions

1. Should we support custom LLM prompts per repository via config file?
2. What's the preferred behavior for very large PRs (>50 MDX files)?
3. Should we auto-approve PRs with rating 5/5, or always leave as COMMENT?
4. Do we want to support reviewing other file types (MD, TXT)?
5. Should suggestions be collapsible or expanded by default?

---

## Appendix

### Example LLM Response
```json
{
  "rating": 4,
  "summary": "Well-structured content with clear explanations. Minor improvements needed for consistency and examples.",
  "suggestions": [
    {
      "file": "src/pages/browse/singleton.mdx",
      "line_start": 12,
      "line_end": 15,
      "reason": "Add concrete code example to illustrate the singleton pattern",
      "suggestion": "A singleton ensures only one instance exists:\n\n```javascript\nclass Singleton {\n  static instance = null;\n  static getInstance() {\n    if (!this.instance) this.instance = new Singleton();\n    return this.instance;\n  }\n}\n```"
    },
    {
      "file": "src/pages/browse/singleton.mdx",
      "line_start": 23,
      "line_end": 23,
      "reason": "Fix capitalization for consistency",
      "suggestion": "## Common Use Cases"
    }
  ]
}
```

### Example GitHub Review Comment
```markdown
## AI Content Review - Rating: 4/5

**Summary:** Well-structured content with clear explanations. Minor improvements needed for consistency and examples.

---

### Suggestions (2)

The AI has provided inline code suggestions below. Review each one and click "Apply suggestion" if you agree.

**Note:** These are AI-generated suggestions. Please review carefully before applying.
```

### File Structure
```
.github/
  workflows/
    mdx-review.yml          # Workflow definition

actions/
  mdx-review/
    action.yml              # Action metadata
    index.ts                # Single file with all logic
    package.json            # Dependencies (AI SDK, etc.)
    tsconfig.json           # TypeScript config
    README.md               # Action documentation
    dist/                   # Compiled JavaScript (gitignored)
      index.js

prd.md                      # This document (project root)
```

---

## Sign-off

This PRD serves as the source of truth for the MDX Content Review GitHub Action project. Any changes to scope or requirements should be documented here.

**Next Steps:**
1. Review and approve PRD
2. Begin Phase 1 implementation
3. Set up test repository
4. Implement core functionality
5. Iterate based on testing feedback
