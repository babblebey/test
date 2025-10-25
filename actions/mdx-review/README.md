# MDX Content Review Action

Automatically review MDX content in Pull Requests using LLM (Large Language Model) and provide actionable code suggestions directly within GitHub's PR review interface.

## Features

- 🤖 Automated quality review of MDX content using AI
- 💡 Inline code suggestions using GitHub's native suggestion feature
- ⭐ Consistent rating rubric (1-5 scale) via LLM
- 🔒 Secure handling of API keys and sensitive content
- 🎯 Configurable LLM provider, model, and parameters
- 📊 Detailed review metrics and token usage tracking

## Usage

### Basic Setup

1. **Add the workflow file** to your repository at `.github/workflows/mdx-review.yml`:

```yaml
name: MDX Content Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - '**/*.mdx'

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd actions/mdx-review
          npm ci
      
      - name: Build action
        run: |
          cd actions/mdx-review
          npm run build
      
      - uses: ./actions/mdx-review
        with:
          api_key: ${{ secrets.OPENAI_API_KEY }}
          provider: 'openai'
          model: 'gpt-4o-mini'
```

2. **Add your API key** as a repository secret:
   - Go to Settings → Secrets and variables → Actions
   - Add `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` for Claude)

### Configuration

#### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api_key` | API key for the LLM provider | Yes | - |
| `provider` | LLM provider (`openai`, `anthropic`) | No | `openai` |
| `model` | Model name | No | `gpt-4o-mini` |
| `temperature` | Temperature (0.0-1.0) | No | `0.3` |
| `max_tokens` | Maximum tokens for response | No | `2000` |
| `approval_threshold` | Min rating to approve (1-5) | No | `4` |
| `max_files` | Max files to process per PR | No | `20` |
| `prompt_template` | Custom prompt template | No | - |
| `github_token` | GitHub token for API access | No | `${{ github.token }}` |

#### Outputs

| Output | Description |
|--------|-------------|
| `rating` | Overall content quality rating (1-5) |
| `files_processed` | Number of files reviewed |
| `suggestions_count` | Total number of suggestions provided |
| `tokens_used` | Estimated tokens used by LLM |
| `estimated_cost` | Estimated cost in USD |

### Advanced Configuration

#### Using Claude (Anthropic)

```yaml
- uses: ./actions/mdx-review
  with:
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    provider: 'anthropic'
    model: 'claude-3-5-sonnet-20241022'
```

#### Custom Prompt Template

```yaml
- uses: ./actions/mdx-review
  with:
    api_key: ${{ secrets.OPENAI_API_KEY }}
    prompt_template: |
      Review this documentation file: {file_path}
      
      Content:
      {file_content}
      
      Focus on technical accuracy and code examples.
```

#### Skip Reviews with Label

Add the label `ai-skip-review` to any PR to skip the automated review.

## Development

### Setup

```bash
cd actions/mdx-review
npm install
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Testing

```bash
npm test
```

### Linting & Formatting

```bash
npm run lint
npm run format
```

## How It Works

1. **Trigger**: Action runs when a PR is opened/updated with MDX file changes
2. **Filter**: Identifies all `.mdx` files in the PR
3. **Review**: Sends each file to the LLM with review criteria
4. **Parse**: Extracts rating, summary, and suggestions from LLM response
5. **Post**: Creates a GitHub PR review with inline code suggestions

## Review Criteria

The LLM evaluates content based on:

- **Clarity**: Is the writing clear and easy to understand?
- **Accuracy**: Are technical details correct?
- **Structure**: Is the content well-organized?
- **Style**: Does it follow best practices?
- **MDX Syntax**: Are MDX components used correctly?

## Security

- API keys are masked in logs using `core.setSecret()`
- Content is sanitized before sending to LLM (removes potential secrets)
- Minimal GitHub token permissions required (`contents: read`, `pull-requests: write`)
- No logging of sensitive data

## Cost Management

- Token estimation before LLM calls
- Configurable file limits
- Output includes cost estimates
- Typical cost: ~$0.01-0.05 per PR

## Troubleshooting

### Action fails with "API key not found"

Make sure you've added the API key as a repository secret and referenced it correctly in the workflow.

### No review posted

Check that:
- The PR contains `.mdx` file changes
- The PR doesn't have the `ai-skip-review` label
- The workflow has `pull-requests: write` permission

### LLM timeout or rate limit

The action includes automatic retry logic. If persistent, reduce `max_files` or increase rate limits with your provider.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.

## Support

For issues and questions, please open a GitHub issue in this repository.
