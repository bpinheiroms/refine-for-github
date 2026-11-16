# Stacked PRs in lists

A group header is shown when at least two PRs of the same stack are on the page.
Rows are matched by GitHub's stack number when the badge exposes it, otherwise by
author + stack size + ticket key (`ABC-123`) in the title or branch name.

The header shows the ticket (or "Stack"), the stack number, how many of its PRs are on
the page, and the title of the first PR. Collapsed state is kept per tab
(`sessionStorage`).

`GRLib.stack.orderStack` sorts a stack bottom → top from each PR's head/base branches.
