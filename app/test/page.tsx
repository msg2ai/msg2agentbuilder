"use client";

import { useState, useEffect } from "react";

/**
 * Test page to manually send messages and observe responses
 * Open browser DevTools console to see detailed logging
 */
export default function TestPage() {
  const [phoneNumber, setPhoneNumber] = useState("+15555551234");
  const [message, setMessage] = useState("Tell me a short joke");
  const [status, setStatus] = useState("Ready");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${msg}`;
    setLogs((prev) => [...prev, logMsg]);
    console.log(logMsg);
  };

  useEffect(() => {
    // Listen for ChatKit events
    const handleChatkitMessage = (event: CustomEvent) => {
      addLog(
        `✅ chatkit:message event: ${JSON.stringify(event.detail).substring(0, 100)}`,
      );
    };

    const handleChatkitError = (event: CustomEvent) => {
      addLog(`❌ chatkit:error event: ${JSON.stringify(event.detail)}`);
    };

    window.addEventListener(
      "chatkit:message" as any,
      handleChatkitMessage as any,
    );
    window.addEventListener("chatkit:error" as any, handleChatkitError as any);

    // Monitor window properties
    const monitorInterval = setInterval(() => {
      const lastResponse = (window as any).__chatkitLastResponse;
      const isComplete = (window as any).__chatkitResponseComplete;
      const timestamp = (window as any).__chatkitResponseTimestamp;

      if (lastResponse && lastResponse.length > 0) {
        addLog(
          `📊 Window property update: ${lastResponse.length} chars, complete: ${isComplete}`,
        );
      }
    }, 2000);

    return () => {
      window.removeEventListener(
        "chatkit:message" as any,
        handleChatkitMessage as any,
      );
      window.removeEventListener(
        "chatkit:error" as any,
        handleChatkitError as any,
      );
      clearInterval(monitorInterval);
    };
  }, []);

  const sendTestMessage = async () => {
    setStatus("Sending message...");
    addLog(
      `📤 Dispatching incoming-sms event: from=${phoneNumber}, message="${message}"`,
    );

    // Clear previous response
    (window as any).__chatkitLastResponse = "";
    (window as any).__chatkitResponseComplete = false;

    // Dispatch the event
    window.dispatchEvent(
      new CustomEvent("incoming-sms", {
        detail: {
          from: phoneNumber,
          message: message,
        },
      }),
    );

    setStatus("Waiting for response...");
    addLog("⏳ Waiting for ChatKit response...");

    // Poll for response
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    const pollInterval = setInterval(() => {
      attempts++;
      const response = (window as any).__chatkitLastResponse;
      const isComplete = (window as any).__chatkitResponseComplete;

      if (response && response.length > 0 && isComplete) {
        clearInterval(pollInterval);
        setStatus("✅ Response received!");
        addLog(`✅ Response received: ${response.substring(0, 200)}...`);
      } else if (response && response.length > 0) {
        addLog(`🔄 Response streaming: ${response.length} chars...`);
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setStatus("⏱️ Timeout - no response");
        addLog("⚠️ Timeout waiting for response");
      }
    }, 1000);
  };

  const inspectDOM = async () => {
    addLog("🔍 Inspecting ChatKit DOM...");

    const chatkitElement = document.querySelector("openai-chatkit");
    if (!chatkitElement) {
      addLog("❌ ChatKit element not found");
      return;
    }

    addLog("✅ ChatKit element found");

    if (!chatkitElement.shadowRoot) {
      addLog("❌ Shadow root not available");
      return;
    }

    addLog("✅ Shadow root available");

    // Try different selectors
    const selectors = [
      '[data-role="assistant"]',
      '[role="assistant"]',
      ".assistant-message",
      '[data-message-role="assistant"]',
    ];

    for (const selector of selectors) {
      try {
        const elements = chatkitElement.shadowRoot.querySelectorAll(selector);
        if (elements.length > 0) {
          addLog(
            `✅ Found ${elements.length} elements with selector: ${selector}`,
          );
          const lastElement = elements[elements.length - 1];
          const text = lastElement.textContent || "";
          addLog(`   Last message: ${text.substring(0, 100)}...`);
        } else {
          addLog(`   No elements found with selector: ${selector}`);
        }
      } catch (e) {
        addLog(`   Error with selector ${selector}: ${e}`);
      }
    }

    // Get all text content
    const allText = chatkitElement.shadowRoot.textContent || "";
    addLog(`📝 Total shadow DOM text length: ${allText.length} chars`);
    addLog(`   Preview: ${allText.substring(0, 200)}...`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          ChatKit Response Extraction Test
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Send Test Message
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  onClick={sendTestMessage}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
                >
                  Send Test Message
                </button>

                <button
                  onClick={inspectDOM}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md"
                >
                  Inspect ChatKit DOM
                </button>

                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Status: <span className="font-medium">{status}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Instructions
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>
                  Open your browser DevTools (F12) and go to the Console tab
                </li>
                <li>Enter a workflow ID in the ChatKit panel on the right</li>
                <li>Wait for ChatKit to initialize (check console logs)</li>
                <li>
                  Click &ldquo;Send Test Message&rdquo; to inject a test message
                </li>
                <li>Watch the console and logs below for response streaming</li>
                <li>
                  Click &ldquo;Inspect ChatKit DOM&rdquo; to see Shadow DOM
                  contents
                </li>
              </ol>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Logs
              </h2>
              <button
                onClick={() => setLogs([])}
                className="text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded"
              >
                Clear
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-4 h-[600px] overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  No logs yet...
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className="mb-1 text-gray-800 dark:text-gray-200"
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            💡 What to Look For
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
            <li>
              Check console for &ldquo;[ChatKitPanel] Message update&rdquo; logs
              - these show streaming responses
            </li>
            <li>
              Look for &ldquo;chatkit:message&rdquo; events being dispatched
            </li>
            <li>
              Monitor window.__chatkitLastResponse for response text
              accumulation
            </li>
            <li>
              Inspect Shadow DOM to see if assistant messages are rendering
            </li>
            <li>
              Check for multiple &ldquo;Response ended&rdquo; events with empty
              responses
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
