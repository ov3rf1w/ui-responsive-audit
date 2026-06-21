# Contributing

Thanks for improving `UI-responsive-audit`.

## Development

Run the local validation before opening a pull request:

```powershell
npm run validate
python "$env:USERPROFILE\.codex\skills\.system\skill-creator\scripts\quick_validate.py" .
```

## Pull Request Checklist

- Keep the skill focused on responsive UI QA.
- Update `README.md` when behavior or configuration changes.
- Update `CHANGELOG.md` for user-visible changes.
- Add or adjust script validation when adding new scripts.
- Include a real audit report excerpt or screenshot path when fixing detection logic.

## Design Principles

- Prefer a sample-first workflow before full screenshot matrices.
- Prefer measurable DOM geometry checks before manual screenshot review.
- Treat screenshots as evidence, not as the only source of truth.
- Keep output paths deterministic and easy to share.
- Avoid project-specific assumptions unless they are configurable.
