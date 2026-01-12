# Contributing to CX DAM

Thank you for your interest in contributing to CX DAM! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're here to build great software together.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/cx-dam.git`
3. Add upstream remote: `git remote add upstream https://github.com/original/cx-dam.git`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

Copy `.env.example` to `.env` and configure your local development environment.

### 3. Run Tests

```bash
npm test
```

### 4. Start Development Servers

```bash
npm run dev
```

### 5. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 6. Commit Your Changes

We use conventional commits:

```bash
git commit -m "feat: add asset tagging feature"
git commit -m "fix: resolve upload timeout issue"
git commit -m "docs: update API documentation"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 7. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define types explicitly
- Use Zod for runtime validation

### Naming Conventions

- Variables/functions: `camelCase`
- Classes/Types: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` or `PascalCase.tsx` (React components)

### File Organization

```typescript
// 1. Imports (external first, then internal)
import express from 'express';
import { z } from 'zod';

import { config } from '../config';
import { logger } from '../utils/logger';

// 2. Types/Interfaces
interface MyInterface {
  id: string;
  name: string;
}

// 3. Constants
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// 4. Implementation
export class MyClass {
  // ...
}

// 5. Exports (if not inline)
export { MyClass };
```

## Testing Guidelines

### Unit Tests

Test individual functions and methods in isolation:

```typescript
import { BloomFilter } from './bloom-filter';

describe('BloomFilter', () => {
  it('should return false for items not added', () => {
    const filter = new BloomFilter();
    expect(filter.mightContain('test')).toBe(false);
  });

  it('should return true for items that were added', () => {
    const filter = new BloomFilter();
    filter.add('test');
    expect(filter.mightContain('test')).toBe(true);
  });
});
```

### Integration Tests

Test API endpoints and database interactions:

```typescript
import request from 'supertest';
import { createApp } from '../app';

describe('POST /api/assets/upload-url', () => {
  it('should return 401 without authentication', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/assets/upload-url')
      .send({ name: 'test.png' });

    expect(response.status).toBe(401);
  });
});
```

### E2E Tests

Test complete user workflows:

```typescript
import { test, expect } from '@playwright/test';

test('user can upload an asset', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Login with GitHub');
  // ... complete OAuth flow
  await page.goto('/upload');
  await page.setInputFiles('input[type="file"]', 'test-image.png');
  await page.fill('input[name="name"]', 'Test Image');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=Upload successful')).toBeVisible();
});
```

## Pull Request Process

1. **Update Documentation**: If you've changed APIs or added features, update the README and relevant docs.

2. **Add Tests**: All new features should have tests.

3. **Run Checks Locally**:
   ```bash
   npm run type-check
   npm run lint
   npm test
   ```

4. **Write a Good PR Description**:
   - What problem does this solve?
   - How does it solve it?
   - Any breaking changes?
   - Screenshots (for UI changes)

5. **Request Review**: Tag appropriate reviewers.

6. **Address Feedback**: Respond to all review comments.

7. **Squash Commits**: Clean up your commit history before merging.

## PR Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe your testing approach.

## Checklist
- [ ] My code follows the project's code style
- [ ] I have updated the documentation
- [ ] I have added tests
- [ ] All tests pass locally
- [ ] I have updated the CHANGELOG (if applicable)

## Screenshots (if applicable)
```

## Project Structure

Understanding the architecture:

```
cx-dam/
├── apps/
│   ├── backend/          # API server
│   │   ├── src/
│   │   │   ├── config/       # Configuration
│   │   │   ├── db/           # Database
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── services/     # Business logic
│   │   │   ├── repositories/ # Data access
│   │   │   ├── routes/       # API routes
│   │   │   └── utils/        # Utilities
│   │   └── package.json
│   └── frontend/         # React app
│       ├── src/
│       │   ├── api/          # API clients
│       │   ├── components/   # React components
│       │   ├── pages/        # Page components
│       │   ├── stores/       # State management
│       │   └── App.tsx
│       └── package.json
└── packages/
    └── shared/           # Shared code
        ├── src/
        │   ├── types/        # TypeScript types
        │   ├── utils/        # Shared utilities
        │   └── constants/    # Shared constants
        └── package.json
```

## Common Tasks

### Adding a New API Endpoint

1. Define types in `packages/shared/src/types/`
2. Create route handler in `apps/backend/src/routes/`
3. Add business logic in `apps/backend/src/services/`
4. Add data access in `apps/backend/src/repositories/`
5. Add frontend API client in `apps/frontend/src/api/`
6. Add tests

### Adding a New React Component

1. Create component in `apps/frontend/src/components/`
2. Use TypeScript and shared types
3. Style with Tailwind CSS
4. Add to Storybook (if applicable)

### Adding a Database Migration

1. Update `apps/backend/src/db/schema.sql`
2. Create migration script if needed
3. Test migration on clean database
4. Document changes

## Debugging Tips

### Backend Debugging

```bash
# Enable debug logging
NODE_ENV=development npm run dev

# Use Node.js inspector
node --inspect apps/backend/dist/index.js
```

### Frontend Debugging

- Use React DevTools extension
- Use Redux DevTools for state debugging
- Check Network tab for API calls
- Use browser console for errors

### Database Debugging

```bash
# Connect to local database
psql -U postgres -d cxdam

# View query logs
# In postgresql.conf, set:
# log_statement = 'all'
```

## Performance Optimization

- Profile before optimizing
- Use React.memo for expensive components
- Implement pagination for large lists
- Add database indexes for frequent queries
- Use CDN for static assets
- Implement caching strategies

## Security Considerations

- Never commit secrets
- Validate all user input
- Use parameterized queries
- Implement rate limiting
- Keep dependencies updated
- Follow OWASP guidelines

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)

## Questions?

- Open an issue for bugs
- Start a discussion for feature requests
- Ask in team chat for quick questions

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
