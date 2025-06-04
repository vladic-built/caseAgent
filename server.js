const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { tools, executeTool, getStaffStats } = require('./tools');
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

// Chat endpoint with streaming support
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, stream = false } = req.body;
    
    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    console.log('Sending messages to Anthropic:', messages);
    console.log('Streaming enabled:', stream);
    
    if (stream) {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      try {
        // Create streaming response
        const stream = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 2048,
          messages: messages,
          tools: tools,
          stream: true,
          system: 'When using tools, do not include any explanatory text before or after the tool use. Simply use the tool and provide the results directly.'
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
              } catch (e) {
                console.error('Error parsing tool input:', e);
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
              // Execute tools
              const toolResults = [];
              for (const toolUse of toolUseBlocks) {
                try {
                  const result = executeTool(toolUse.name, toolUse.input);
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: result
                  });
                } catch (error) {
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
              if (fullContent.length > 0 && fullContent.join('').trim()) {
                assistantContent.push({
                  type: 'text',
                  text: fullContent.join('')
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
              
              // Make another streaming call with tool results
              const finalStream = await anthropic.messages.create({
                model: 'claude-3-7-sonnet-latest',
                max_tokens: 2048,
                messages: updatedMessages,
                tools: tools,
                stream: true,
                system: 'When using tools, do not include any explanatory text before or after the tool use. Simply use the tool and provide the results directly.'
              });
              
              // Stream the final response
              for await (const event of finalStream) {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
              }
            }
          }
        }
        
        // Send done event
        res.write('data: [DONE]\n\n');
        res.end();
        
      } catch (error) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
      
    } else {
      // Non-streaming response (existing code)
      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-latest',
        max_tokens: 2048,
        messages: messages,
        tools: tools,
        system: 'When using tools, do not include any explanatory text before or after the tool use. Simply use the tool and provide the results directly.'
      });
      
      console.log('Anthropic response:', response);
      
      // Check if Claude wants to use a tool
      if (response.stop_reason === 'tool_use') {
        // Handle tool use
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        const toolResults = [];
        
        for (const toolUse of toolUseBlocks) {
          try {
            const result = executeTool(toolUse.name, toolUse.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result
            });
          } catch (error) {
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
        
        // Make another API call with the tool results
        const finalResponse = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 2048,
          messages: updatedMessages,
          tools: tools,
          system: 'When using tools, do not include any explanatory text before or after the tool use. Simply use the tool and provide the results directly.'
        });
        
        // Extract text content from the final response
        let responseText = '';
        if (finalResponse.content && Array.isArray(finalResponse.content)) {
          responseText = finalResponse.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
        }
        
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
        
        res.json({ response: responseText });
      }
    }
    
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    res.status(500).json({ 
      error: 'Error processing your request', 
      details: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  const staffStats = getStaffStats();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to set your ANTHROPIC_API_KEY in the .env file');
  console.log(`Staff directory loaded with ${staffStats.count} employees across ${staffStats.departments} departments`);
  console.log('Available tools: Staff Directory Lookup, Company Calculator');
  console.log('Streaming support: Enabled');
}); 