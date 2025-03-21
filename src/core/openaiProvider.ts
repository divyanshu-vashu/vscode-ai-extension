import OpenAI from 'openai';

interface OpenAIProviderConfig {
  apiKey: string;
  baseURL?: string;
  modelName?: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ResponseBlock {
  type: 'text' | 'code';
  content?: string;
  language?: string;
  file?: string;
  code?: string;
}

export class OpenAIProvider {
  private openai: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAIProviderConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    this.defaultModel = config.modelName || 'gpt-3.5-turbo';
  }

  async generateCompletion(
      prompt: string, 
      context?: string, 
      model?: string, 
      systemPrompt: string = 'You are a helpful code AI assistant.'

      
    ): Promise<ResponseBlock[]> {
      try {
        if (!prompt.trim()) {
          return [{ type: 'text', content: 'Please provide a valid prompt.' }];
        }

        const modelToUse = model || this.defaultModel;
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt }
        ];

        const response = await this.openai.chat.completions.create({
          model: modelToUse,
          messages
        });

        return this.parseResponse(response.choices[0].message.content || '');
      } catch (error: unknown) {
        console.error('OpenAI API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return [{ 
          type: 'text', 
          content: `Error with OpenAI API: ${errorMessage}` 
        }];
      }
    }

  private parseResponse(text: string): ResponseBlock[] {
    const blocks: ResponseBlock[] = [];
    const lines = text.split('\n');
    let currentBlock: ResponseBlock | null = null;
    let codeContent = '';

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (currentBlock) {
          // End of code block
          currentBlock.code = codeContent.trim();
          blocks.push(currentBlock);
          currentBlock = null;
          codeContent = '';
        } else {
          // Start of code block
          const language = line.slice(3).trim();
          currentBlock = {
            type: 'code',
            language: language || 'plaintext'
          };
        }
      } else if (currentBlock) {
        codeContent += line + '\n';
      } else if (line.trim()) {
        blocks.push({
          type: 'text',
          content: line.trim()
        });
      }
    }

    // Handle unclosed code blocks
    if (currentBlock) {
      currentBlock.code = codeContent.trim();
      blocks.push(currentBlock);
    }

    return blocks;
  }

  async getEmbeddings(text: string, model: string = 'text-embedding-ada-002'): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: model,
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  // Utility method to format response blocks back into a single string
  formatResponseBlocks(blocks: ResponseBlock[]): string {
    return blocks.map(block => {
      if (block.type === 'code') {
        return `\`\`\`${block.language || ''}\n${block.code || ''}\n\`\`\``;
      }
      return block.content || '';
    }).join('\n\n');
  }
}