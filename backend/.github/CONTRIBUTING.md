# Contributing to Backend

## Development Workflow

### 1. Before Starting Work

```bash
# Install dependencies
make install

# Or using pnpm directly
pnpm install --frozen-lockfile
```

### 2. During Development

```bash
# Run in watch mode
pnpm run start:dev

# Run tests in watch mode
pnpm run test:watch
```

### 3. Before Committing

**ALWAYS run the CI checks before committing:**

```bash
make ci
```

This ensures:
- ✅ Code passes linting (ESLint)
- ✅ All tests pass
- ✅ Project builds successfully

### 4. If CI Fails

**Linting Issues:**
```bash
# Auto-fix most issues
pnpm run lint

# Check specific files
pnpm run lint -- src/path/to/file.ts
```

**Test Failures:**
```bash
# Run specific test
pnpm run test -- roles.guard.spec.ts

# Run with coverage
pnpm run test:cov

# Debug in watch mode
pnpm run test:watch
```

**Build Errors:**
```bash
# Clean and rebuild
make clean
make build
```

## Code Quality Standards

### TypeScript

- Use strict typing (avoid `any`)
- Prefer interfaces over types for object shapes
- Use enums for fixed sets of values

### Testing

- Write unit tests for all guards, services, and controllers
- Aim for >80% code coverage
- Test both success and error cases
- Use descriptive test names

### Linting

- Follow ESLint rules (auto-fix with `pnpm run lint`)
- Use Prettier for formatting (configured in `.prettierrc`)
- No unused variables or imports

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: add your feature"

# 3. Run CI checks
make ci

# 4. Push if all checks pass
git push origin feature/your-feature-name
```

## Common Issues

### "pnpm: command not found"

```bash
npm install -g pnpm
```

### "make: command not found"

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
Use WSL or Git Bash, or run commands directly:
```bash
pnpm run lint && pnpm run test && pnpm run build
```

### Database Connection Issues

Check your `.env` file has correct `DATABASE_URL`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

## Need Help?

- Check the [README.md](../README.md) for setup instructions
- Review [src/common/guards/README.md](../src/common/guards/README.md) for RBAC usage
- Open an issue for bugs or questions
