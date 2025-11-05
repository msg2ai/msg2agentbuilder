# Contributing to Msg2AgentBuilder

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/msg2agentbuilder.git
   cd msg2agentbuilder
   ```
3. **Add the upstream repository**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/msg2agentbuilder.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for testing ChatKit functionality)
- (Optional) Twilio account for SMS integration testing
- (Optional) Docker for virtual display testing
- (Optional) Google Cloud account for deployment testing

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your credentials:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `NEXT_PUBLIC_WORKFLOW_ID` - Your ChatKit workflow ID
   - `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` - Your ChatKit domain key
   - (Optional) Twilio credentials for SMS testing

3. **Start the development server**:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to see your changes.

### Docker Development (Optional)

To test virtual display features locally:

```bash
docker-compose -f docker-compose.virtual-display.yml up -d
```

Connect via VNC at `vnc://localhost:5900` (password: `password`)

## Making Changes

### Branch Naming Convention

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

Example: `feature/add-whatsapp-integration`

### Commit Messages

Write clear, concise commit messages:

**Good:**

```
Add WhatsApp webhook integration

- Implement /api/whatsapp-webhook route
- Add message parsing and response handling
- Update documentation with setup instructions
```

**Bad:**

```
fixed stuff
```

### Keep Changes Focused

- One feature or fix per pull request
- Break large changes into smaller, reviewable PRs
- Update tests and documentation alongside code changes

## Submitting Changes

1. **Sync with upstream**:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit:

   ```bash
   git add .
   git commit -m "Description of changes"
   ```

4. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots/videos for UI changes
   - Ensure all checks pass

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for type safety
- Follow existing code formatting (Prettier is configured)
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Avoid `any` types when possible

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use proper TypeScript typing for props

### File Organization

- Place components in `components/`
- Place API routes in `app/api/`
- Place utilities in `lib/`
- Place tests alongside the code they test

### Examples

**Good:**

```typescript
interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
}

const formatMessage = (message: ChatMessage): string => {
  return `[${message.timestamp.toISOString()}] ${message.content}`;
};
```

**Bad:**

```typescript
const fmt = (msg: any) => {
  return msg.timestamp + " " + msg.content;
};
```

## Testing

### Running Tests

```bash
# Test virtual display
node tests/test-virtual-display.js

# Test ChatKit integration
node tests/test-chatkit-visible.js

# Test SMS integration (requires Twilio credentials)
node tests/test-sms-direct-injection.js
```

### Writing Tests

- Add tests for new features
- Update tests when modifying existing features
- Test both success and error cases
- Use descriptive test names

## Documentation

### When to Update Documentation

Update documentation when you:

- Add new features
- Change configuration options
- Modify API endpoints
- Update deployment procedures
- Fix bugs that affect usage

### Documentation Files

- `README.md` - Overview and quick start
- `ARCHITECTURE.md` - System architecture and design
- `DEPLOYMENT.md` - Deployment instructions
- `TWILIO_INTEGRATION.md` - SMS integration guide
- Code comments - Inline documentation for complex logic

### Documentation Style

- Use clear, concise language
- Provide code examples
- Include command-line examples with expected output
- Add screenshots for UI-related documentation
- Keep documentation up-to-date with code changes

## Questions or Issues?

- Open an issue for bugs or feature requests
- Use discussions for questions and ideas
- Tag maintainers for urgent issues

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers this project.

---

Thank you for contributing! 🎉
