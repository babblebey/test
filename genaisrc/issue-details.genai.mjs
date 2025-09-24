const issue = await github.getIssue();

def("ISSUE", issue.body);

$`Analyze the current ISSUE and ask for additional details if the issue is unclear.`