# Entire CLI Setup for ContextOS

Use Entire if you want Codex session checkpointing and rewind support while working in this repository.

## 1. Install Entire CLI

Choose one installation method:

```bash
# Homebrew
brew tap entireio/tap
brew install --cask entire

# or install script
curl -fsSL https://entire.io/install.sh | bash
```

## 2. Enable Entire in this repository

From repository root:

```bash
entire enable --agent codex
entire status
```

If your CLI version does not support `--agent codex`, run:

```bash
entire enable
```

Then select the closest Codex/OpenAI agent option interactively.

## 3. Optional configuration

Disable telemetry:

```bash
entire configure --telemetry=false
```

## 4. Team workflow notes

- Entire stores session metadata on its own checkpoint branch.
- Your feature branch history remains focused on project commits.
- Use `entire rewind` to restore an earlier AI checkpoint when needed.

## References

- https://entire.io/
- https://github.com/entireio/cli
