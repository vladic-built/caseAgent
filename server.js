const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { tools, executeTool } = require('./tools');
const { systemPrompt } = require('./prompts');
require('dotenv').config();

// Initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Enhanced logging function
function logWithTimestamp(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Chat endpoint with streaming support
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, stream = false } = req.body;
    
    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    logWithTimestamp('=== NEW CHAT REQUEST ===');
    logWithTimestamp('Request type:', stream ? 'STREAMING' : 'NON-STREAMING');
    logWithTimestamp('User message:', messages[messages.length - 1]?.content || 'N/A');
    
    if (stream) {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      try {
        // Validate API key before making request
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is not configured');
        }
        
        // Create streaming response
        const stream = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: messages,
          tools: tools,
          stream: true,
          system: systemPrompt
        });
        
        let fullContent = [];
        let toolUseBlocks = [];
        let currentToolUse = null;
        let currentTextBlock = '';
        
        // Process stream events
        for await (const event of stream) {
          // Send the raw event to the client
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          
          // Handle different event types
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              logWithTimestamp('🔧 TOOL USE STARTED', {
                tool_id: event.content_block.id,
                tool_name: event.content_block.name
              });
              
              // Save any accumulated text before starting tool use
              if (currentTextBlock) {
                fullContent.push(currentTextBlock);
                currentTextBlock = '';
              }
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: ''
              };
            } else if (event.content_block.type === 'text') {
              currentTextBlock = '';
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentTextBlock += event.delta.text;
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              try {
                currentToolUse.input = JSON.parse(currentToolUse.input);
                toolUseBlocks.push(currentToolUse);
                logWithTimestamp('🔧 TOOL USE COMPLETED', {
                  tool_name: currentToolUse.name,
                  tool_input: currentToolUse.input
                });
              } catch (e) {
                logWithTimestamp('❌ Error parsing tool input:', e);
              }
              currentToolUse = null;
            } else if (currentTextBlock) {
              fullContent.push(currentTextBlock);
              currentTextBlock = '';
            }
          } else if (event.type === 'message_stop') {
            // Save any remaining text
            if (currentTextBlock) {
              fullContent.push(currentTextBlock);
            }
            
            // Check if we need to handle tool use
            if (toolUseBlocks.length > 0) {
              logWithTimestamp('🔧 EXECUTING TOOLS', { count: toolUseBlocks.length });
              
              // Execute tools
              const toolResults = [];
              for (const toolUse of toolUseBlocks) {
                try {
                  logWithTimestamp(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);
                  const result = await executeTool(toolUse.name, toolUse.input);
                  logWithTimestamp(`✅ Tool result for ${toolUse.name}:`, result);
                  
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: result
                  });
                } catch (error) {
                  logWithTimestamp(`❌ Tool execution error for ${toolUse.name}:`, error.message);
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: `Error executing tool: ${error.message}`,
                    is_error: true
                  });
                }
              }
              
              // Send tool execution event
              res.write(`data: ${JSON.stringify({ type: 'tool_execution', tool_results: toolResults })}\n\n`);
              
              // Continue conversation with tool results
              const assistantContent = [];
              
              // Add any text content that was accumulated
              const accumulatedText = fullContent.join('').trim();
              if (accumulatedText) {
                assistantContent.push({
                  type: 'text',
                  text: accumulatedText
                });
              }
              
              // Add tool use blocks
              for (const toolUse of toolUseBlocks) {
                assistantContent.push({
                  type: 'tool_use',
                  id: toolUse.id,
                  name: toolUse.name,
                  input: toolUse.input
                });
              }
              
              // Ensure we have content for the assistant message
              if (assistantContent.length === 0) {
                // If no text was accumulated, add an empty text block
                assistantContent.push({
                  type: 'text',
                  text: ''
                });
              }
              
              const updatedMessages = [
                ...messages,
                {
                  role: 'assistant',
                  content: assistantContent
                },
                {
                  role: 'user',
                  content: toolResults
                }
              ];
              
              logWithTimestamp('🔄 Making follow-up request with tool results...');
              logWithTimestamp('Assistant content being sent:', assistantContent);
              logWithTimestamp('Tool results being sent:', toolResults);
              
              // Make another streaming call with tool results
              const finalStream = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: updatedMessages,
                tools: tools,
                stream: true,
                system: systemPrompt
              });
              
              // Send signal that follow-up response is starting
              res.write(`data: ${JSON.stringify({ type: 'followup_response_start' })}\n\n`);
              
              // Stream the final response
              logWithTimestamp('📤 Starting to stream final response...');
              for await (const event of finalStream) {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
                
                // Log text content being streamed
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  logWithTimestamp('📝 Streaming text:', event.delta.text);
                }
              }
              logWithTimestamp('✅ Final response streaming completed');
            }
          }
        }
        
        // Send done event
        res.write('data: [DONE]\n\n');
        res.end();
        logWithTimestamp('✅ Streaming response completed');
        
      } catch (error) {
        logWithTimestamp('❌ Streaming error:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Check if response is still writable before sending error
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message || 'An unexpected error occurred during streaming' 
          })}\n\n`);
          res.end();
        }
      }
      
    } else {
      // Validate API key before making request
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }
      
      // Non-streaming response (existing code)
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: messages,
        tools: tools,
        system: systemPrompt
      });
      
      // Check if Claude wants to use a tool
      if (response.stop_reason === 'tool_use') {
        logWithTimestamp('🔧 Tool use detected in non-streaming response');
        
        // Handle tool use
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        logWithTimestamp('🔧 Tool use blocks:', toolUseBlocks);
        
        const toolResults = [];
        
        for (const toolUse of toolUseBlocks) {
          try {
            logWithTimestamp(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);
            const result = await executeTool(toolUse.name, toolUse.input);
            logWithTimestamp(`✅ Tool result for ${toolUse.name}:`, result);
            
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result
            });
          } catch (error) {
            logWithTimestamp(`❌ Tool execution error for ${toolUse.name}:`, error.message);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error executing tool: ${error.message}`,
              is_error: true
            });
          }
        }
        
        // Add the assistant's tool use to the conversation
        const updatedMessages = [
          ...messages,
          {
            role: 'assistant',
            content: response.content
          },
          {
            role: 'user',
            content: toolResults
          }
        ];
        
        logWithTimestamp('🔄 Making follow-up request with tool results...');
        
        // Make another API call with the tool results
        const finalResponse = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 2048,
          messages: updatedMessages,
          tools: tools,
          system: systemPrompt
        });
        
        // Extract text content from the final response
        let responseText = '';
        if (finalResponse.content && Array.isArray(finalResponse.content)) {
          responseText = finalResponse.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
        }
        
        logWithTimestamp('Final response text:', responseText);
        res.json({ response: responseText });
      } else {
        // Extract text content from the response (no tool use)
        let responseText = '';
        if (response.content && Array.isArray(response.content)) {
          responseText = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
        }
        
        logWithTimestamp('Response text (no tools):', responseText);
        res.json({ response: responseText });
      }
    }
    
  } catch (error) {
    logWithTimestamp('❌ API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      status: error.status
    });
    
    // Check if response has already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error processing your request', 
        details: error.message || 'An unexpected error occurred'
      });
    }
  }
});

// Start the server
app.listen(PORT, () => {
  logWithTimestamp(`🚀 Server running on http://localhost:${PORT}`);
  logWithTimestamp('Make sure to set your ANTHROPIC_API_KEY, OPENAI_API_KEY, and PINECONE_API_KEY in the .env file');
  logWithTimestamp(`Available tools: ${tools.map(t => t.name).join(', ')}`);
  logWithTimestamp('RAG System: Enabled');
  logWithTimestamp('Streaming support: Enabled');
  logWithTimestamp('Enhanced logging: Enabled');
}); 