document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Store conversation history
    const conversationHistory = [
        { role: 'assistant', content: 'Hello! I\'m Claude. How can I help you today?' }
    ];

    // Add streaming toggle
    let streamingEnabled = true;

    // Function to format text content (preserve line breaks and basic formatting)
    function formatContent(content) {
        // Convert newlines to <br> tags and preserve spaces
        let formatted = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
            .replace(/`(.*?)`/g, '<code>$1</code>') // `code`
            .replace(/  /g, '&nbsp;&nbsp;'); // preserve double spaces
        
        return formatted;
    }

    // Function to add a message to the chat
    function addMessage(role, content, messageId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(role === 'user' ? 'user-message' : 'system-message');
        if (messageId) {
            messageDiv.id = messageId;
        }
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        // Use innerHTML for formatted content, but only for assistant messages
        // User messages should remain as plain text for security
        if (role === 'user') {
            messageContent.textContent = content;
        } else {
            messageContent.innerHTML = formatContent(content);
        }
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Auto scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Only add to history if content is provided
        if (content) {
            conversationHistory.push({ role, content });
        }
        
        return messageDiv;
    }

    // Function to update a message's content
    function updateMessage(messageId, content) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            const messageContent = messageDiv.querySelector('.message-content');
            messageContent.innerHTML = formatContent(content);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Function to add loading indicator
    function addLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'system-message', 'loading');
        loadingDiv.id = 'loading-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            loadingDiv.appendChild(dot);
        }
        
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to remove loading indicator
    function removeLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    // Function to handle streaming response
    async function sendMessageWithStreaming(userMessage) {
        // Add user message to chat
        addMessage('user', userMessage);
        
        // Clear input
        userInput.value = '';
        
        // Disable send button and input while processing
        sendButton.disabled = true;
        userInput.disabled = true;
        
        // Create a placeholder for the assistant's response
        const messageId = `assistant-message-${Date.now()}`;
        const assistantMessageDiv = addMessage('assistant', '', messageId);
        let accumulatedContent = '';
        let isToolUse = false;
        let pendingText = '';  // Buffer for text that might be tool-related
        let hasSeenToolUse = false;
        
        // Add a placeholder to conversation history for the assistant's response
        conversationHistory.push({ role: 'assistant', content: '' });
        const assistantHistoryIndex = conversationHistory.length - 1;
        
        try {
            // Format messages for API
            const apiMessages = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // Make streaming request
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    messages: apiMessages,
                    stream: true 
                })
            });
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            // Stream finished
                            break;
                        }
                        
                        try {
                            const event = JSON.parse(data);
                            
                            // Handle different event types
                            if (event.type === 'content_block_delta') {
                                if (event.delta.type === 'text_delta') {
                                    if (!hasSeenToolUse) {
                                        // Buffer text until we know if a tool will be used
                                        pendingText += event.delta.text;
                                    } else {
                                        // Tool has been used, this is the response text
                                        accumulatedContent += event.delta.text;
                                        updateMessage(messageId, accumulatedContent);
                                    }
                                }
                            } else if (event.type === 'content_block_start') {
                                if (event.content_block.type === 'tool_use') {
                                    hasSeenToolUse = true;
                                    // Clear any pending text that was just explaining the tool use
                                    pendingText = '';
                                }
                            } else if (event.type === 'content_block_stop') {
                                // If we have pending text and no tool was used, show it
                                if (pendingText && !hasSeenToolUse) {
                                    accumulatedContent += pendingText;
                                    updateMessage(messageId, accumulatedContent);
                                    pendingText = '';
                                }
                            } else if (event.type === 'message_stop') {
                                // Final check for any remaining pending text
                                if (pendingText && !hasSeenToolUse) {
                                    accumulatedContent += pendingText;
                                    updateMessage(messageId, accumulatedContent);
                                }
                            } else if (event.type === 'tool_execution') {
                                // Tool was executed, continue processing
                            } else if (event.type === 'error') {
                                throw new Error(event.error);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
            
            // Update conversation history with the final content
            conversationHistory[assistantHistoryIndex].content = accumulatedContent || '(Used tool to get information)';
            
        } catch (error) {
            console.error('Error:', error);
            updateMessage(messageId, 'Sorry, there was an error processing your request.');
            // Update the conversation history with error message
            conversationHistory[assistantHistoryIndex].content = 'Sorry, there was an error processing your request.';
        } finally {
            // Re-enable send button and input
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        }
    }

    // Function to send message without streaming (existing functionality)
    async function sendMessageNonStreaming(userMessage) {
        // Add user message to chat
        addMessage('user', userMessage);
        
        // Clear input
        userInput.value = '';
        
        // Disable send button and input while processing
        sendButton.disabled = true;
        userInput.disabled = true;
        
        // Add loading indicator
        addLoadingIndicator();
        
        try {
            // Format messages for API
            const apiMessages = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // Call API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    messages: apiMessages,
                    stream: false 
                })
            });
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const data = await response.json();
            
            // Remove loading indicator
            removeLoadingIndicator();
            
            // Add assistant response to chat
            addMessage('assistant', data.response);
            
        } catch (error) {
            console.error('Error:', error);
            removeLoadingIndicator();
            addMessage('system', 'Sorry, there was an error processing your request.');
        } finally {
            // Re-enable send button and input
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        }
    }

    // Main send message function
    async function sendMessage() {
        const userMessage = userInput.value.trim();
        
        if (!userMessage) return;
        
        if (streamingEnabled) {
            await sendMessageWithStreaming(userMessage);
        } else {
            await sendMessageNonStreaming(userMessage);
        }
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Add streaming toggle to the UI
    const headerDiv = document.querySelector('.chat-header');
    const toggleDiv = document.createElement('div');
    toggleDiv.style.marginTop = '10px';
    toggleDiv.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
            <input type="checkbox" id="streaming-toggle" ${streamingEnabled ? 'checked' : ''}>
            <span>Enable streaming responses</span>
        </label>
    `;
    headerDiv.appendChild(toggleDiv);
    
    document.getElementById('streaming-toggle').addEventListener('change', (e) => {
        streamingEnabled = e.target.checked;
        console.log('Streaming enabled:', streamingEnabled);
    });
    
    // Focus input on load
    userInput.focus();
}); 