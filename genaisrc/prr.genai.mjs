script({
    title: "Pull Request Reviewer",
    description: "Review the current pull request",
    systemSafety: true,
    parameters: {
        base: "",
    },
})
const { dbg, vars } = env
// const base = vars.base || (await git.defaultBranch())
// const changes = await git.diff({
//     base,
//     llmify: true,
// })
// if (!changes) cancel("No changes found in the pull request")
// dbg(`changes: %s`, changes)

const pull_request = await github.getPullRequest();
// await github.createReaction("pull_request", pull_request?.number || env.vars.pull_request_number, "eyes");
const { client } = await github.api();
  
const { data: files } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
  owner: 'babblebey',
  repo: 'test',
  pull_number: pull_request?.number,
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

const gitDiff = def("GIT_DIFF", files[0].patch, {
  language: "diff",
  maxTokens: 14000,
  detectPromptInjection: "available",
});

$`Report errors in ${gitDiff} using the annotation format.

- Use best practices of the programming language of each file.
- If available, provide a URL to the official documentation for the best practice. do NOT invent URLs.
- Analyze ALL the code. Do not be lazy. This is IMPORTANT.
- Use tools to read the entire file content to get more context
- Do not report warnings, only errors.
- Add suggestions if possible, skip if you are not sure about a fix.
`