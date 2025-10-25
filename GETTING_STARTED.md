# MDX Review Action - Getting Started

## ✅ Phase 1 Complete!

All core functionality has been successfully implemented. Here's what we've built:

### 📁 Project Structure

```
actions/mdx-review/
├── action.yml          # Action metadata and configuration
├── index.ts            # Main TypeScript implementation
├── package.json        # Dependencies (AI SDK, GitHub Actions toolkit)
├── tsconfig.json       # TypeScript configuration
├── README.md           # Comprehensive documentation
├── .gitignore          # Git ignore rules
└── dist/              # Compiled JavaScript (ready to run)
    └── index.js

.github/workflows/
└── mdx-review.yml     # GitHub workflow that triggers the action
```

### 🎯 What It Does

1. **Triggers** on PRs with MDX file changes
2. **Fetches** changed `.mdx` files from the PR
3. **Reviews** each file using an LLM (OpenAI GPT-4o-mini by default)
4. **Rates** content on a 1-5 scale based on:
   - Clarity
   - Accuracy
   - Structure
   - Style
   - MDX Syntax
5. **Posts** review comments with inline code suggestions

### 🚀 Next Steps

#### 1. Set Up Your API Key

You need to add your OpenAI API key as a repository secret:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `OPENAI_API_KEY`
5. Value: Your OpenAI API key

#### 2. Test the Action

To test the action, you can:

**Option A: Create a test PR**
1. Create a new branch
2. Add or modify an `.mdx` file in `src/content/` or `src/pages/`
3. Create a pull request
4. The action will automatically run and post a review

**Option B: Test locally with sample files**
- The action is ready to review the existing MDX files in your workspace:
  - `src/content/dictionary/*.mdx`
  - `src/pages/browse/*.mdx`

#### 3. Customize (Optional)

Edit `.github/workflows/mdx-review.yml` to customize:

```yaml
- uses: ./actions/mdx-review
  with:
    provider: 'openai'           # or 'anthropic' for Claude
    model: 'gpt-4o-mini'         # or 'gpt-4o', 'claude-3-5-sonnet-20241022'
    temperature: '0.3'           # 0.0 = deterministic, 1.0 = creative
    max_tokens: '2000'           # Max response length
    approval_threshold: '4'      # Rating needed to approve (1-5)
    max_files: '20'              # Max files per PR
```

### 📊 Features Included

✅ **AI-Powered Reviews**
- Uses AI SDK (supports OpenAI, Anthropic, and more)
- Structured output with Zod schema validation
- Configurable model and parameters

✅ **GitHub Integration**
- Native PR review comments
- Inline code suggestions with `suggestion` blocks
- Automatic rating and summary

✅ **Security**
- API key masking in logs
- Content sanitization (removes potential secrets)
- Minimal GitHub token permissions

✅ **Error Handling**
- Graceful fallback on LLM failures
- Automatic retry logic (ready for Phase 2)
- Clear error messages

✅ **Configuration**
- 8 customizable inputs
- 5 informative outputs
- Optional custom prompts

### 📝 Example Review Output

When the action runs, it will post a review like this:

```markdown
## 🤖 AI Content Review - Rating: 4/5 ⭐⭐⭐⭐

**Files Reviewed:** 2
**Total Suggestions:** 3

### Summary by File

- **src/pages/browse/singleton.mdx** (4/5): Well-structured content with clear explanations. Minor improvements for examples.
- **src/content/dictionary/tuple.mdx** (5/5): Excellent documentation with comprehensive examples.

---

### 💡 Suggestions

The AI has provided inline code suggestions below. Review each one and click "Commit suggestion" if you agree.

**Note:** These are AI-generated suggestions. Please review carefully before applying.
```

Plus inline comments on specific lines with code suggestions!

### 🧪 Testing Checklist

Before going live, test these scenarios:

- [ ] Create PR with new `.mdx` file → Should post review
- [ ] Create PR with modified `.mdx` file → Should post review
- [ ] Create PR with non-MDX files only → Should skip silently
- [ ] Add `ai-skip-review` label to PR → Should skip with log message
- [ ] PR with 5+ MDX files → Should handle all files
- [ ] Check that suggestions are correctly formatted and applicable

### 🐛 Troubleshooting

**Build fails:**
```bash
cd actions/mdx-review
npm install
npm run build
```

**Action doesn't run:**
- Check workflow file is in `.github/workflows/`
- Verify PR contains `.mdx` file changes
- Check workflow has correct permissions

**Review not posted:**
- Verify `OPENAI_API_KEY` is set in repository secrets
- Check action logs in GitHub Actions tab
- Ensure workflow has `pull-requests: write` permission

### 📚 Phase 2 Preview

Ready for more? Phase 2 will add:

- Enhanced JSON schema validation
- Retry logic with exponential backoff
- Token counting and cost estimation
- Advanced content sanitization
- Multi-file batching optimization

### 🎉 You're All Set!

The action is ready to use. Just add your API key and create a test PR to see it in action!

For detailed documentation, see `actions/mdx-review/README.md`.

---

**Need help?** Check the PRD at `prd.md` for full specifications and architecture details.
