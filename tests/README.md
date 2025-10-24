# Test Suite

Comprehensive testing for DOM inspection and SMS-to-ChatKit integration.

## Quick Start

```bash
# Run DOM inspection tests
node tests/test-dom-inspection.js

# Test ChatKit in visible browser
node tests/test-chatkit-visible.js

# Test SMS integration (requires app running)
npm run dev  # Terminal 1
node tests/test-sms-direct-injection.js  # Terminal 2
```

## Test Scripts

### DOM Inspection Tests

- **test-dom-inspection.js** - Comprehensive DOM testing (11 tests, 96.7% success)
  - Basic DOM querying
  - Shadow DOM inspection (critical for ChatKit)
  - Form elements and events
  - CSS selectors and computed styles

### ChatKit Integration Tests

- **test-agentkit-ui.js** - Full application testing (10/10 tests passed)
- **test-agentkit-chatkit-widget.js** - Deep widget inspection
- **test-chatkit-visible.js** - Non-headless browser testing
- **capture-chatkit-screenshot.js** - Screenshot utilities
- **debug-chatkit-loading.js** - Network and console debugging

### SMS Integration Tests

- **test-sms-direct-injection.js** - Direct SMS injection with visible conversation ⭐
- **test-sms-to-chatkit.js** - End-to-end SMS webhook testing
- **test-chatkit-interaction.js** - Message interaction testing

### Virtual Display Tests

- **test-virtual-display.js** - Virtual display verification

## SMS Testing with Curl

### Localhost

```bash
curl -X POST http://localhost:3000/api/sms-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B15551234567" \
  -d "Body=Hello! Can you tell me a joke about programming?"
```

### Google Cloud Run

```bash
curl -X POST https://YOUR-SERVICE-URL/api/sms-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B15551234567" \
  -d "Body=Hello! Can you tell me a joke about programming?"
```

## Key Findings

- ✅ ChatKit requires **non-headless mode** (works with Xvfb virtual display)
- ✅ Shadow DOM is fully accessible
- ✅ SMS integration works end-to-end
- ✅ Screenshots capture complete conversations

## See Also

- [DOM Inspection Summary](../docs/DOM-INSPECTION-SUMMARY.md)
- [Browser Modes Explained](../docs/BROWSER-MODES-EXPLAINED.md)
- [Virtual Display README](../docs/VIRTUAL-DISPLAY-README.md)
