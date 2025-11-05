"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  DOMAIN_KEY,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending",
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  const processedSmsIds = useRef(new Set<string>());
  const currentSmsNumber = useRef<string | null>(null);
  const currentResponseText = useRef<string>("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState<string | null>(
    null,
  );

  // Session-based workflow ID state
  const [sessionWorkflowId, setSessionWorkflowId] = useState<string>(
    () => WORKFLOW_ID,
  );
  const [workflowInputValue, setWorkflowInputValue] = useState<string>(
    () => WORKFLOW_ID,
  );
  const [showWorkflowConfirmation, setShowWorkflowConfirmation] =
    useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);

  // OpenAI API Key state
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyInputValue, setApiKeyInputValue] = useState<string>("");
  const [showApiKeyConfirmation, setShowApiKeyConfirmation] = useState(false);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // SSE Stream Interception - capture ChatKit responses from network
  useEffect(() => {
    if (!isBrowser) return;

    console.log("[ChatKitPanel] 🌐 Setting up SSE stream interception...");

    const originalFetch = window.fetch;

    window.fetch = async function (
      ...args: Parameters<typeof fetch>
    ): Promise<Response> {
      const [resource, options] = args;
      const url =
        typeof resource === "string" ? resource : (resource as Request).url;

      // Call original fetch
      const response = await originalFetch(...args);

      // Intercept ChatKit conversation SSE streams
      if (
        url.includes("api.openai.com") &&
        url.includes("chatkit/conversation")
      ) {
        console.log("[SSE Intercept] 📡 ChatKit conversation request detected");
        console.log("[SSE Intercept] URL:", url);
        console.log("[SSE Intercept] Status:", response.status);

        const contentType = response.headers.get("content-type") || "";
        console.log("[SSE Intercept] Content-Type:", contentType);

        // Clone response so we can read it without consuming the original
        const clonedResponse = response.clone();

        // Read SSE stream
        if (clonedResponse.body) {
          const reader = clonedResponse.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedText = "";

          // Read stream in background
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  console.log(
                    "[SSE Intercept] ✅ Stream complete. Total text:",
                    accumulatedText.length,
                    "chars",
                  );
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });

                // Parse SSE format: "data: {json}\n\n"
                const lines = chunk.split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const dataStr = line.substring(6).trim();
                    if (!dataStr || dataStr === "[DONE]") continue;

                    try {
                      const parsed = JSON.parse(dataStr);

                      // Log the raw parsed data for debugging
                      if (isDev) {
                        console.log(
                          "[SSE Intercept] 🔍 Raw SSE data:",
                          JSON.stringify(parsed).substring(0, 200),
                        );
                      }

                      // Extract content from various SSE formats
                      let content = null;

                      // ChatKit format: message.content[].text
                      if (
                        parsed.message?.content &&
                        Array.isArray(parsed.message.content)
                      ) {
                        const textContent = parsed.message.content
                          .filter((item: any) => item.type === "output_text")
                          .map((item: any) => item.text)
                          .join("");

                        if (textContent) {
                          content = textContent;
                          accumulatedText = content; // Replace, not append (full message)
                        }
                      }
                      // ChatKit format: content[].text
                      else if (
                        parsed.content &&
                        Array.isArray(parsed.content)
                      ) {
                        const textContent = parsed.content
                          .filter((item: any) => item.type === "output_text")
                          .map((item: any) => item.text)
                          .join("");

                        if (textContent) {
                          content = textContent;
                          accumulatedText = content; // Replace, not append
                        }
                      }
                      // Delta format (streaming chunks)
                      else if (parsed.delta?.content) {
                        content = parsed.delta.content;
                        accumulatedText += content;
                      }
                      // Simple content field
                      else if (
                        parsed.content &&
                        typeof parsed.content === "string"
                      ) {
                        content = parsed.content;
                        accumulatedText = content;
                      }
                      // OpenAI API format
                      else if (parsed.choices?.[0]?.delta?.content) {
                        content = parsed.choices[0].delta.content;
                        accumulatedText += content;
                      } else if (parsed.choices?.[0]?.message?.content) {
                        content = parsed.choices[0].message.content;
                        accumulatedText = content;
                      }

                      if (content) {
                        console.log(
                          "[SSE Intercept] 📝 Content chunk:",
                          content.substring(0, 100),
                        );

                        // Update current response and window
                        currentResponseText.current = accumulatedText;
                        (window as any).__chatkitLastResponse = accumulatedText;
                        (window as any).__chatkitResponseTimestamp = Date.now();
                      }
                    } catch (e) {
                      // Not JSON or parse error - skip
                      if (isDev) {
                        console.log(
                          "[SSE Intercept] ⚠️ Failed to parse SSE line:",
                          dataStr.substring(0, 100),
                        );
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error("[SSE Intercept] ❌ Error reading stream:", error);
            }
          })();
        }
      }

      return response;
    };

    console.log("[ChatKitPanel] ✅ SSE interception active");

    // Cleanup: restore original fetch
    return () => {
      console.log("[ChatKitPanel] 🔄 Restoring original fetch");
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener,
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            }),
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener,
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    sessionWorkflowId && !sessionWorkflowId.startsWith("wf_replace"),
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Please enter a valid Workflow ID above.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending",
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  // DOM polling function to extract response from ChatKit Shadow DOM + iframe
  const startDOMPolling = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clear any existing polling interval
    if ((window as any).__domPollingInterval) {
      clearInterval((window as any).__domPollingInterval);
    }

    console.log("[ChatKitPanel] Starting DOM polling for response text...");

    // Track iframe access attempts
    let iframeAccessAttempts = 0;
    let iframeAccessible = false;

    (window as any).__domPollingInterval = setInterval(() => {
      const chatkitElement = document.querySelector("openai-chatkit");
      if (!chatkitElement || !chatkitElement.shadowRoot) return;

      // ChatKit renders content inside an iframe within the Shadow DOM
      const iframe = chatkitElement.shadowRoot.querySelector(
        "iframe.ck-iframe",
      ) as HTMLIFrameElement;

      if (!iframe) {
        console.log("[ChatKitPanel] ⚠️ iframe not found in shadow DOM");
        return;
      }

      // Try to access iframe content (with retry logic)
      try {
        // Check if iframe has loaded and is accessible
        if (!iframe.contentDocument || !iframe.contentWindow) {
          iframeAccessAttempts++;
          if (iframeAccessAttempts % 10 === 0) {
            console.log(
              "[ChatKitPanel] ⏳ Waiting for iframe to load...",
              iframeAccessAttempts,
              "attempts",
            );
          }
          return;
        }

        // Check if iframe body exists
        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc.body) {
          iframeAccessAttempts++;
          return;
        }

        // First successful access
        if (!iframeAccessible) {
          iframeAccessible = true;
          console.log("[ChatKitPanel] ✅ iframe content is accessible!");
        }

        // Strategy 1: Try specific selectors for assistant messages
        const selectors = [
          '[data-role="assistant"]',
          '[role="assistant"]',
          '[data-message-role="assistant"]',
          ".assistant-message",
          ".message--assistant",
          '[class*="assistant"]',
          '[class*="Message"]',
          '[data-testid*="message"]',
        ];

        for (const selector of selectors) {
          try {
            const messages = iframeDoc.querySelectorAll(selector);
            if (messages && messages.length > 0) {
              // Get the last assistant message
              const lastMessage = messages[messages.length - 1];
              const text = (
                lastMessage.textContent ||
                lastMessage.innerText ||
                ""
              ).trim();

              if (text && text.length > 0 && !text.includes("How can I help")) {
                // Only update if text has changed
                if (text !== currentResponseText.current) {
                  currentResponseText.current = text;
                  (window as any).__chatkitLastResponse = text;
                  (window as any).__chatkitResponseTimestamp = Date.now();

                  console.log(
                    "[ChatKitPanel] 📝 DOM extracted response (selector:",
                    selector + "):",
                    text.length,
                    "chars",
                  );
                  console.log(
                    "[ChatKitPanel] Preview:",
                    text.substring(0, 100) + "...",
                  );
                }
                return; // Found it, exit
              }
            }
          } catch (e) {
            // Selector might not be valid, continue to next
          }
        }

        // Strategy 2: Get all text and filter intelligently
        try {
          const bodyText = (iframeDoc.body.textContent || "").trim();
          if (bodyText.length > 0) {
            // Split into lines and filter
            const lines = bodyText
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => {
                // Keep lines that are substantial and not UI elements
                return (
                  line.length > 15 && // Minimum length
                  !line.includes("How can I help") &&
                  !line.includes("Send message") &&
                  !line.includes("Ask anything") &&
                  !line.includes("What can you do") &&
                  !line.includes("Workflow:") &&
                  !line.includes("SMS Conversation") &&
                  !line.match(/^\+?\d+$/) && // Not just a phone number
                  !line.match(/^wf_/) && // Not a workflow ID
                  !line.match(/^[a-f0-9]{32,}$/i) // Not a hash/ID
                );
              });

            if (lines.length > 0) {
              // Get the longest substantive line (likely the response)
              const longestLine = lines.reduce(
                (a, b) => (a.length > b.length ? a : b),
                "",
              );

              if (
                longestLine.length > 15 &&
                longestLine !== currentResponseText.current
              ) {
                currentResponseText.current = longestLine;
                (window as any).__chatkitLastResponse = longestLine;
                (window as any).__chatkitResponseTimestamp = Date.now();
                console.log(
                  "[ChatKitPanel] 📝 Extracted via text filtering:",
                  longestLine.length,
                  "chars",
                );
                console.log(
                  "[ChatKitPanel] Preview:",
                  longestLine.substring(0, 100),
                );
              }
            }
          }
        } catch (e) {
          console.error("[ChatKitPanel] Error in text filtering:", e);
        }
      } catch (error) {
        // iframe access error (cross-origin or not loaded)
        if (iframeAccessAttempts === 0) {
          console.error(
            "[ChatKitPanel] ❌ Cannot access iframe content:",
            error,
          );
        }
        iframeAccessAttempts++;
      }
    }, 500); // Poll every 500ms
  }, []);

  // Stop DOM polling
  const stopDOMPolling = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).__domPollingInterval) {
      clearInterval((window as any).__domPollingInterval);
      (window as any).__domPollingInterval = null;
      console.log("[ChatKitPanel] Stopped DOM polling");
    }
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: sessionWorkflowId,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail = "Please enter a valid Workflow ID above.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const requestBody: any = {
          workflow: { id: sessionWorkflowId },
          chatkit_configuration: {
            // enable attachments
            file_upload: {
              enabled: true,
            },
          },
        };

        // Include API key if provided
        if (apiKey) {
          requestBody.apiKey = apiKey;
        }

        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError,
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        console.log(
          "[ChatKitPanel] ========== Session created successfully ==========",
        );
        console.log(
          "[ChatKitPanel] Client secret received:",
          clientSecret.substring(0, 20) + "...",
        );
        console.log("[ChatKitPanel] Session ready for messages");

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, sessionWorkflowId, apiKey, setErrorState],
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        // Enable attachments
        enabled: true,
      },
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: async (response?: { text?: string }) => {
      console.log("[ChatKitPanel] ========== Response ended ==========");
      console.log(
        "[ChatKitPanel] Response object keys:",
        response ? Object.keys(response) : "null",
      );
      console.log(
        "[ChatKitPanel] Response text:",
        response?.text?.substring(0, 100),
      );
      console.log(
        "[ChatKitPanel] Accumulated text (DOM):",
        currentResponseText.current.substring(0, 100),
      );

      // Stop DOM polling
      stopDOMPolling();

      // Wait a moment for final DOM update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Use accumulated response text (from DOM) if response.text is empty
      const finalText = response?.text || currentResponseText.current;

      // Store final response in window for Puppeteer (Solution 3)
      if (isBrowser && finalText) {
        (window as any).__chatkitLastResponse = finalText;
        (window as any).__chatkitResponseComplete = true;
        (window as any).__chatkitResponseTimestamp = Date.now();
        console.log(
          "[ChatKitPanel] Stored response in window, length:",
          finalText.length,
        );
      }

      // Dispatch chatkit:message event for browserless mode to capture
      if (isBrowser && finalText) {
        console.log(
          "[ChatKitPanel] Dispatching chatkit:message event with",
          finalText.length,
          "chars",
        );
        window.dispatchEvent(
          new CustomEvent("chatkit:message", {
            detail: {
              role: "assistant",
              content: finalText,
            },
          }),
        );
      } else {
        console.log("[ChatKitPanel] ⚠️  No response text to dispatch!");
      }

      // SMS sending is handled by the webhook itself using SSE interception
      console.log(
        "[ChatKitPanel] SMS sending handled by webhook (not by client-side)",
      );

      // Reset accumulated response
      currentResponseText.current = "";

      console.log("[ChatKitPanel] response end");
      onResponseEnd();
    },
    onResponseStart: () => {
      console.log("[ChatKitPanel] ========== Response started ==========");
      console.log("[ChatKitPanel] Timestamp:", new Date().toISOString());
      currentResponseText.current = ""; // Reset on new response
      setErrorState({ integration: null, retryable: false });

      // Start polling DOM for response text since onMessageUpdate doesn't exist
      if (isBrowser) {
        (window as any).__chatkitResponseComplete = false;
        startDOMPolling();
      }
    },
    onThreadChange: () => {
      console.log("[ChatKitPanel] Thread changed");
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("[ChatKitPanel] ========== ChatKit error ==========");
      console.error("[ChatKitPanel] Error:", error);
      console.error(
        "[ChatKitPanel] Error details:",
        JSON.stringify(error, null, 2),
      );

      // Dispatch error event for browserless mode
      if (isBrowser) {
        window.dispatchEvent(
          new CustomEvent("chatkit:error", {
            detail: { error: String(error) },
          }),
        );
      }
    },
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: sessionWorkflowId,
      chatkitState: chatkit.control ? "initialized" : "not-initialized",
    });
  }

  // Log when chatkit control becomes available and update script status
  useEffect(() => {
    if (chatkit.control) {
      if (isDev) {
        console.log(
          "[ChatKitPanel] ========== ChatKit control initialized ==========",
        );
        console.log("[ChatKitPanel] ChatKit is ready to send/receive messages");
      }
      // If we have control, the script must be loaded
      if (scriptStatus === "pending") {
        setScriptStatus("ready");
      }
    }
  }, [chatkit.control, scriptStatus]);

  // Listen for incoming SMS events from browserless mode
  useEffect(() => {
    console.log(
      "[ChatKitPanel] Setting up incoming-sms listener, control available:",
      Boolean(chatkit.control),
    );

    if (!chatkit.control || !isBrowser) {
      console.log(
        "[ChatKitPanel] Waiting for chatkit.control to be available...",
      );
      return;
    }

    const handleIncomingSms = async (event: CustomEvent) => {
      const { from, message } = event.detail;
      console.log("[ChatKitPanel] ========== Incoming SMS Event ==========");
      console.log("[ChatKitPanel] From:", from);
      console.log("[ChatKitPanel] Message:", message);

      // Update display phone number
      setDisplayPhoneNumber(from);
      currentSmsNumber.current = from;

      try {
        console.log("[ChatKitPanel] Calling chatkit.sendUserMessage...");

        await chatkit.sendUserMessage({
          text: message,
        });

        console.log(
          "[ChatKitPanel] ✅ SMS successfully injected into ChatKit!",
        );
      } catch (error) {
        console.error("[ChatKitPanel] ❌ Error injecting SMS:", error);
      }
    };

    window.addEventListener("incoming-sms" as any, handleIncomingSms as any);

    console.log("[ChatKitPanel] ✅ Incoming SMS listener registered");

    // Set flag for browserless mode to detect readiness
    (window as any).__chatkitReady = true;
    // Expose workflow ID for testing
    (window as any).NEXT_PUBLIC_WORKFLOW_ID = sessionWorkflowId;

    return () => {
      window.removeEventListener(
        "incoming-sms" as any,
        handleIncomingSms as any,
      );
      (window as any).__chatkitReady = false;
    };
  }, [chatkit.control, chatkit.sendUserMessage]);

  // Combined update handler for both fields
  const handleCombinedUpdate = useCallback(async () => {
    const workflowChanged =
      workflowInputValue.trim() &&
      workflowInputValue.trim() !== sessionWorkflowId;
    const apiKeyChanged =
      apiKeyInputValue.trim() && apiKeyInputValue.trim() !== apiKey;

    if (!workflowChanged && !apiKeyChanged) {
      return;
    }

    setIsResettingSession(true);

    // Update workflow ID if changed
    if (workflowChanged) {
      setSessionWorkflowId(workflowInputValue.trim());
      setShowWorkflowConfirmation(true);
    }

    // Update API key if changed
    if (apiKeyChanged) {
      const trimmedKey = apiKeyInputValue.trim();
      if (!trimmedKey.startsWith("sk-")) {
        alert('Invalid API key format. OpenAI API keys start with "sk-"');
        setIsResettingSession(false);
        return;
      }
      setApiKey(trimmedKey);
      setShowApiKeyConfirmation(true);
    }

    // Reset the chat session
    processedFacts.current.clear();
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);

    // Hide confirmations after 5 seconds
    setTimeout(() => {
      setShowWorkflowConfirmation(false);
      setShowApiKeyConfirmation(false);
      setIsResettingSession(false);
    }, 5000);
  }, [workflowInputValue, sessionWorkflowId, apiKeyInputValue, apiKey]);

  return (
    <div className="relative flex h-[750px] w-full max-w-4xl mx-auto rounded-2xl flex-col overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      {/* Title Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b-2 border-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
        <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white">
          Msg2AgentBuilder - SMS Integration with Agent Builder (OpenAI)
        </h1>
      </div>

      {/* Phone Number Display - Prominent when active */}
      {displayPhoneNumber && (
        <div className="flex-shrink-0 px-4 py-3 border-b-2 border-green-500 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                SMS Conversation:
              </span>
            </div>
            <span className="text-sm font-mono font-medium text-green-700 dark:text-green-300">
              {displayPhoneNumber}
            </span>
          </div>
        </div>
      )}

      {/* Configuration Input Section - Single Update Button */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="space-y-2">
          {/* Workflow ID Input */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="workflow-id-input"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 w-20"
            >
              Workflow:
            </label>
            <input
              id="workflow-id-input"
              type="text"
              value={workflowInputValue}
              onChange={(e) => setWorkflowInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCombinedUpdate();
                }
              }}
              placeholder="wf_xxxxx"
              className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isResettingSession}
            />
          </div>

          {/* API Key Input */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="api-key-input"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 w-20"
            >
              API Key:
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKeyInputValue}
              onChange={(e) => setApiKeyInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCombinedUpdate();
                }
              }}
              placeholder="sk-..."
              className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              disabled={isResettingSession}
            />
            {apiKey && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {apiKey.substring(0, 10)}...
              </span>
            )}
          </div>

          {/* Single Update Button */}
          <div className="flex justify-end">
            <button
              onClick={handleCombinedUpdate}
              disabled={
                isResettingSession ||
                (workflowInputValue.trim() === sessionWorkflowId &&
                  apiKeyInputValue.trim() === apiKey) ||
                (!workflowInputValue.trim() && !apiKeyInputValue.trim())
              }
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 rounded transition-colors"
            >
              {isResettingSession ? "Updating..." : "Update Configuration"}
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Update Confirmation Popup */}
      {showWorkflowConfirmation && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="px-4 py-3 bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Workflow Updated!</span>
          </div>
        </div>
      )}

      {/* API Key Update Confirmation Popup */}
      {showApiKeyConfirmation && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="px-4 py-3 bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>API Key Updated!</span>
          </div>
        </div>
      )}

      <ChatKit
        key={widgetInstanceKey}
        {...({ domainKey: DOMAIN_KEY } as any)}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "block flex-1 w-full min-h-[500px]"
        }
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />

      {/* Footer with Open Source and Trademark Notices */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="text-center text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p>
            Released under the{" "}
            <a
              href="https://opensource.org/licenses/MIT"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              MIT License
            </a>
          </p>
          <p className="text-[10px] leading-relaxed">
            Msg2AgentBuilder is a trademark of RethinkLabs. OpenAI is a
            registered trademark of OpenAI, Inc. Twilio is a registered
            trademark of Twilio Inc. All trademarks are the property of their
            respective owners.
          </p>
        </div>
      </div>
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string,
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
