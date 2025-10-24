script({
  description: "Review a word contribution pull request",
  // parameters: {
  //   base: ""
  // },
  tools: "agent_github",
});

// const { client } = await github.api();

// const diff = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
//   owner: 'babblebey',
//   repo: 'test',
//   pull_number: env.vars.pull_request,
//   headers: {
//     'X-GitHub-Api-Version': '2022-11-28'
//   }
// });

// const word = diff.data[0].patch;

// defAgent

// const changes = await git.diff({
//     staged: true,
//     // paths: ["src/content/dictionary/**.mdx"]
// });

// const { dbg, vars } = env
const base = await git.branch()
const changes = await git.diff({
  base,
  llmify: true,
})

def("GIT_DIFF", changes, {
  language: "diff",
  maxTokens: 14000,
  detectPromptInjection: "available",
});

$`You are an AI reviewer for jargons.dev word contributions. 
This Pull Request represents the addition of new word or edit to existing word with changes captured in GIT_DIFF.

Each word is an \`.mdx\` file with YAML frontmatter and a body.

- The \`title\` in the frontmatter contains the word being defined.  
- The body of the file contains the meaning, explanation, and (if necessary) example.  

Your job is to review the body content against the official jargons.dev writing rules and provide structured feedback.

RULES TO ENFORCE:

STYLE & TONE:
- Keep it formal, clear, and simplified.
- Beginner-friendly but precise, no unnecessary jargon.
- SEO-friendly: natural keywords, clarity, and directness.
- Must be accurate and up-to-date with industry standards.
- Short sentences, simple language.
- For acronyms: include the full form/origin if useful.
- For languages/frameworks: mention primary use case or include code snippet if relevant.
- For concepts (e.g. Agile, DevOps): mention their significance in tech.
- Avoid fluff.

STRUCTURE (body content must always follow this flow):
1. Meaning → concise definition.  
2. Further Explanation → short, expanded detail or context.  
3. Example → only if necessary (code snippet or real-world use case).  

FORMATTING:
- Do not repeat the word (frontmatter \`title\`) in the body as a heading.  
- Do not label sections with “Meaning” or “Explanation.”  
- If including an example, prefix it with **Example:** in bold.  

OUT-OF-SCOPE WORDS:
- If the \`title\` is not a valid technical/software/programming/tech word → mark as out-of-scope.  
- Do not ask for clarification. Suggest they search again instead.  

---

### Your Task:
1. Review the \`.mdx\` file (title + body). 
  - In the case where an edit is made to an existing mdx file, use tools to read the entire edited file to get full context.
  - In the case of a new mdx file added, use only the provided content.
2. Check if the body content follows the rules above.  
3. Respond with:  
   - **Star Rating (⭐ 1–5):** Reflects how well it adheres to the rules.  
     - ⭐⭐⭐⭐⭐ = Excellent, fully aligned with rules  
     - ⭐⭐⭐⭐ = Good, minor issues  
     - ⭐⭐⭐ = Fair, needs some corrections  
     - ⭐⭐ = Weak, significant corrections needed  
     - ⭐ = Poor, does not follow rules at all  
   - **Feedback:** Bullet-point list of specific issues/fixes  
   - **Suggested Fix (if needed):** Provide a corrected version of the body only (do not rewrite frontmatter).  

Important: Never remove or edit the frontmatter, only review the body.

`;