    1    Sync dev locally:
git checkout dev
git pull --rebase origin dev
    2    Update your existing branch with latest dev:
git checkout <your-branch>
git rebase dev
# resolve conflicts if any
git push --force-with-lease
    3    Keep working on your branch:
# edit files
git add -A
git commit -m "message"
git push
    4    When ready, open a PR into dev:
    •    base: dev
    •    compare: <your-branch>
    5    After testing is good on dev, open a PR dev -> main and merge for release.
    1    Sync dev locally:
git checkout dev
git pull --rebase origin dev
    2    Update your existing branch with latest dev:
git checkout <your-branch>
git rebase dev
# resolve conflicts if any
git push --force-with-lease
    3    Keep working on your branch:
# edit files
git add -A
git commit -m "message"
git push
    4    When ready, open a PR into dev:
    •    base: dev
    •    compare: <your-branch>
    5    After testing is good on dev, open a PR dev -> main and merge for release.
