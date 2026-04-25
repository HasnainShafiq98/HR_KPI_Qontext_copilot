# Entire CLI Setup for ContextOS

This repo is prepared to work with Entire so Codex sessions can be checkpointed with commits.

## 1. Install Entire CLI

Choose one:

```bash
# Homebrew stable
brew tap entireio/tap
brew install --cask entire

# or install script
curl -fsSL https://entire.io/install.sh | bash
```

## 2. Enable in this repository

From repo root:

```bash
entire enable --agent codex
entire status
```

If your Entire version does not support `codex`, run:

```bash
entire enable
```

and choose the available Codex/OpenAI option interactively.

## 3. Optional: disable telemetry

```bash
entire configure --telemetry=false
```

## 4. Team behavior

- Entire stores session metadata on a separate checkpoint branch.
- Your working branch commit history remains clean.
- Use `entire rewind` to roll back to prior AI checkpoints.

## References

- https://entire.io/
- https://github.com/entireio/cli
