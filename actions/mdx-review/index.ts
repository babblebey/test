/**
 * MDX Content Review GitHub Action
 * 
 * Automatically reviews MDX content in Pull Requests using LLM
 * and provides inline code suggestions via GitHub's review API.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ActionConfig {
  apiKey: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  approvalThreshold: number;
  maxFiles: number;
  promptTemplate: string;
  githubToken: string;
}

interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface Suggestion {
  file: string;
  line_start: number;
  line_end: number;
  reason: string;
  suggestion: string;
}

interface ReviewResult {
  rating: number;
  summary: string;
  suggestions: Suggestion[];
}

interface FileReview {
  file: string;
  content: string;
  result: ReviewResult;
}

// Zod schema for LLM response validation
const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  summary: z.string().max(500),
  suggestions: z.array(
    z.object({
      file: z.string(),
      line_start: z.number().int().positive(),
      line_end: z.number().int().positive(),
      reason: z.string(),
      suggestion: z.string(),
    })
  ),
});

// ============================================================================
// CONFIGURATION
// ============================================================================

function getConfig(): ActionConfig {
  const apiKey = core.getInput('api_key', { required: true });
  core.setSecret(apiKey); // Mask in logs
  
  return {
    apiKey,
    provider: core.getInput('provider') || 'openai',
    model: core.getInput('model') || 'gpt-4o-mini',
    temperature: parseFloat(core.getInput('temperature') || '0.3'),
    maxTokens: parseInt(core.getInput('max_tokens') || '2000', 10),
    approvalThreshold: parseInt(core.getInput('approval_threshold') || '4', 10),
    maxFiles: parseInt(core.getInput('max_files') || '20', 10),
    promptTemplate: core.getInput('prompt_template') || '',
    githubToken: core.getInput('github_token', { required: true }),
  };
}

// ============================================================================
// GITHUB FUNCTIONS
// ============================================================================

async function getChangedFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ChangedFile[]> {
  core.info(`Fetching changed files for PR #${prNumber}...`);
  
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });
  
  return files as ChangedFile[];
}

async function getFileContent(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      ref,
      path,
    });
    
    if ('content' in data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    throw new Error('File content not found');
  } catch (error) {
    core.warning(`Failed to fetch content for ${path}: ${error}`);
    throw error;
  }
}

async function postReview(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  reviews: FileReview[],
  approvalThreshold: number
): Promise<void> {
  const overallRating = Math.round(
    reviews.reduce((sum, r) => sum + r.result.rating, 0) / reviews.length
  );
  
  const allSuggestions = reviews.flatMap(r => r.result.suggestions);
  const reviewEvent = overallRating >= approvalThreshold ? 'COMMENT' : 'COMMENT';
  
  // Build review body
  const body = buildReviewBody(overallRating, reviews, allSuggestions.length);
  
  // Create review comments for each suggestion
  const comments = allSuggestions.map(suggestion => ({
    path: suggestion.file,
    line: suggestion.line_end,
    body: buildSuggestionComment(suggestion),
  }));
  
  core.info(`Posting review with ${comments.length} suggestions...`);
  
  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: reviewEvent,
      body,
      comments: comments.length > 0 ? comments : undefined,
    });
    
    core.info('✅ Review posted successfully!');
  } catch (error) {
    core.error(`Failed to post review: ${error}`);
    throw error;
  }
}

function buildReviewBody(
  rating: number,
  reviews: FileReview[],
  suggestionsCount: number
): string {
  const stars = '⭐'.repeat(rating);
  
  return `## 🤖 AI Content Review - Rating: ${rating}/5 ${stars}

**Files Reviewed:** ${reviews.length}
**Total Suggestions:** ${suggestionsCount}

### Summary by File

${reviews.map(r => `- **${r.file}** (${r.result.rating}/5): ${r.result.summary}`).join('\n')}

---

${suggestionsCount > 0 
  ? '### 💡 Suggestions\n\nThe AI has provided inline code suggestions below. Review each one and click "Commit suggestion" if you agree.\n\n**Note:** These are AI-generated suggestions. Please review carefully before applying.' 
  : '✨ No specific suggestions - content looks good!'}
`;
}

function buildSuggestionComment(suggestion: Suggestion): string {
  return `**${suggestion.reason}**

\`\`\`suggestion
${suggestion.suggestion}
\`\`\``;
}

// ============================================================================
// LLM FUNCTIONS
// ============================================================================

function getLLMProvider(config: ActionConfig) {
  switch (config.provider.toLowerCase()) {
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey });
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

function buildPrompt(filePath: string, content: string, customTemplate?: string): string {
  if (customTemplate) {
    return customTemplate
      .replace('{file_path}', filePath)
      .replace('{file_content}', content);
  }
  
  return `Review this MDX file:

**File:** ${filePath}
**Content:**
\`\`\`mdx
${content}
\`\`\`

Provide a rating (1-5) and specific suggestions for improvement.
Focus on actionable changes that enhance clarity, accuracy, and readability.
For each suggestion, provide the exact replacement text that should replace the specified lines.`;
}

function getSystemPrompt(): string {
  return `You are an expert documentation reviewer specializing in MDX content.
Evaluate content based on:
- Clarity: Is the writing clear and easy to understand?
- Accuracy: Are technical details correct?
- Structure: Is the content well-organized with proper headings and flow?
- Style: Does it follow best practices for technical documentation?
- MDX Syntax: Are MDX components used correctly?

Provide specific, actionable suggestions with exact replacement text.
Each suggestion should target specific line ranges and include the complete replacement content.`;
}

async function reviewFileWithLLM(
  config: ActionConfig,
  filePath: string,
  content: string
): Promise<ReviewResult> {
  core.info(`Reviewing ${filePath} with ${config.provider}/${config.model}...`);
  
  const provider = getLLMProvider(config);
  const modelId = config.model;
  
  try {
    const { object } = await generateObject({
      model: provider(modelId),
      schema: ReviewSchema,
      system: getSystemPrompt(),
      prompt: buildPrompt(filePath, content, config.promptTemplate),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    
    core.info(`✓ Review complete for ${filePath}: ${object.rating}/5`);
    return object as ReviewResult;
  } catch (error) {
    core.error(`LLM review failed for ${filePath}: ${error}`);
    // Return fallback response
    return {
      rating: 3,
      summary: `Automated review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestions: [],
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sanitizeContent(content: string): string {
  // Remove potential secrets before sending to LLM
  let sanitized = content;
  
  // Remove API key patterns
  sanitized = sanitized.replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED_KEY]');
  
  // Remove GitHub tokens
  sanitized = sanitized.replace(/ghp_[A-Za-z0-9]{36}/g, '[REDACTED_TOKEN]');
  
  // Remove bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]');
  
  return sanitized;
}

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function filterMDXFiles(files: ChangedFile[]): ChangedFile[] {
  return files.filter(f => f.filename.endsWith('.mdx'));
}

function shouldSkipPR(labels: string[]): boolean {
  return labels.includes('ai-skip-review');
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

async function run(): Promise<void> {
  try {
    core.info('🚀 Starting MDX Content Review...');
    
    // 1. Get configuration
    const config = getConfig();
    core.info(`Using provider: ${config.provider}, model: ${config.model}`);
    
    // 2. Get GitHub context
    const context = github.context;
    const prNumber = context.payload.pull_request?.number;
    
    if (!prNumber) {
      core.setFailed('This action only works on pull_request events');
      return;
    }
    
    const { owner, repo } = context.repo;
    const octokit = github.getOctokit(config.githubToken);
    
    // 3. Check for skip label
    const labels = context.payload.pull_request?.labels?.map((l: any) => l.name) || [];
    if (shouldSkipPR(labels)) {
      core.info('⏭️  Skipping review: ai-skip-review label found');
      return;
    }
    
    // 4. Get changed files
    const allFiles = await getChangedFiles(octokit, owner, repo, prNumber);
    const mdxFiles = filterMDXFiles(allFiles);
    
    if (mdxFiles.length === 0) {
      core.info('ℹ️  No MDX files changed in this PR');
      return;
    }
    
    core.info(`Found ${mdxFiles.length} MDX file(s) to review`);
    
    // 5. Limit files if necessary
    const filesToReview = mdxFiles.slice(0, config.maxFiles);
    if (mdxFiles.length > config.maxFiles) {
      core.warning(`⚠️  PR has ${mdxFiles.length} MDX files. Reviewing first ${config.maxFiles}.`);
    }
    
    // 6. Review each file
    const reviews: FileReview[] = [];
    let totalTokens = 0;
    
    for (const file of filesToReview) {
      try {
        const ref = context.payload.pull_request?.head.sha;
        const content = await getFileContent(octokit, owner, repo, ref, file.filename);
        const sanitized = sanitizeContent(content);
        const tokens = estimateTokens(sanitized);
        totalTokens += tokens;
        
        core.info(`File: ${file.filename} (~${tokens} tokens)`);
        
        const result = await reviewFileWithLLM(config, file.filename, sanitized);
        reviews.push({ file: file.filename, content: sanitized, result });
      } catch (error) {
        core.warning(`Skipping ${file.filename} due to error: ${error}`);
      }
    }
    
    if (reviews.length === 0) {
      core.setFailed('No files could be reviewed');
      return;
    }
    
    // 7. Post review to GitHub
    await postReview(octokit, owner, repo, prNumber, reviews, config.approvalThreshold);
    
    // 8. Set outputs
    const overallRating = Math.round(
      reviews.reduce((sum, r) => sum + r.result.rating, 0) / reviews.length
    );
    const suggestionsCount = reviews.reduce((sum, r) => sum + r.result.suggestions.length, 0);
    
    core.setOutput('rating', overallRating.toString());
    core.setOutput('files_processed', reviews.length.toString());
    core.setOutput('suggestions_count', suggestionsCount.toString());
    core.setOutput('tokens_used', totalTokens.toString());
    core.setOutput('estimated_cost', (totalTokens * 0.00001).toFixed(4)); // Rough estimate
    
    core.info('✨ Review complete!');
    core.info(`📊 Summary: ${reviews.length} files, ${suggestionsCount} suggestions, ~${totalTokens} tokens`);
    
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.setFailed('Action failed with unknown error');
    }
  }
}

// Run the action
run();
