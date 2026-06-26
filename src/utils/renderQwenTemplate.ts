import type { Message } from '../types';
import type { HandlerParams } from '../types';
import { safeParseArgs } from './safeParseArgs';

export interface RenderQwenOpts {
  messages: Message[];
  tools?: HandlerParams['tools'];
  addGenerationPrompt?: boolean;
  enableThinking?: boolean;
}

export function renderQwenTemplate(opts: RenderQwenOpts): string {
  const { addGenerationPrompt } = opts;
  const messages = opts.messages;
  const tools = opts.tools;
  const hasTools = tools !== undefined && tools.length > 0;
  let thinking = opts.enableThinking !== false;
  const parts: string[] = [];

  /* ── system message extraction ── */
  let sysMsg: Message | undefined;
  let msgs: Message[];
  if (messages.length > 0 && messages[0].role === 'system') {
    sysMsg = messages[0];
    msgs = messages.slice(1);
  } else {
    msgs = messages;
  }

  let sysContent = '';
  if (sysMsg && sysMsg.content) {
    sysContent = sysMsg.content.trim();
    if (sysContent.includes('<|think_off|>')) {
      thinking = false;
      sysContent = sysContent.split('<|think_off|>').join('').trim();
    } else if (sysContent.includes('<|think_on|>')) {
      thinking = true;
      sysContent = sysContent.split('<|think_on|>').join('').trim();
    }
  }

  /* ── tools block ── */
  if (hasTools) {
    let toolBlock = '<|im_start|>system\n# Tools\n\nYou have access to the following functions:\n\n<tools>';
    for (const tool of tools!) {
      toolBlock += '\n' + JSON.stringify(tool);
    }
    toolBlock += '\n</tools>\n\n';
    toolBlock += `If you choose to call a function ONLY reply in the following format with NO suffix:

<think>
Brief explanation of tool call
</think>
<tool_call>
<function=example_function_name>
<parameter=example_parameter_1>
value_1
</parameter>
<parameter=example_parameter_2>
This is the value for the second parameter
that can span
multiple lines
</parameter>
</function>
</tool_call>

<IMPORTANT>
Reminder:
- You can use the <think></think> block to plan your next tool call OR to synthesize data and formulate your final response to the user.
- ALL explanation and reasoning MUST be placed strictly inside the <think></think> block.
- Function calls MUST follow the specified format: an inner <function=...></function> block must be nested within <tool_call></tool_call> XML tags.
- If you choose to call a tool, you MUST output the <tool_call> block IMMEDIATELY after closing </think>. Do NOT output any conversational text before the tool call.
- The <tool_call> and <function> tags MUST be at the very beginning of a new line, with NO spaces or indentation before them.
- To call multiple functions, output a separate, completely closed <tool_call></tool_call> block for EACH function. Do NOT nest <tool_call> blocks.
- If you have gathered all necessary data and do not need to call a tool, answer the question like normal and provide your final response to the user IMMEDIATELY after closing </think>.
</IMPORTANT>`;
    if (sysContent) {
      toolBlock += '\n\n' + sysContent;
    }
    toolBlock += '\n<|im_end|>\n';
    parts.push(toolBlock);
  } else {
    if (sysContent) {
      parts.push('<|im_start|>system\n' + sysContent + '<|im_end|>\n');
    }
  }

  /* ── message loop ── */
  let prevRole = '';
  let consecutiveFailures = 0;
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    let content = (msg.content || '').trim();

    if (content.includes('<|think_off|>')) {
      thinking = false;
      content = content.split('<|think_off|>').join('').trim();
    } else if (content.includes('<|think_on|>')) {
      thinking = true;
      content = content.split('<|think_on|>').join('').trim();
    }

    if (msg.role === 'system') {
      parts.push('<|im_start|>system\n' + content + '<|im_end|>\n');
    } else if (msg.role === 'user') {
      consecutiveFailures = 0;
      parts.push('<|im_start|>user\n' + content + '<|im_end|>\n');
    } else if (msg.role === 'assistant') {
      let as = '<|im_start|>assistant\n';
      as += content || '';
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const fn = tc.function;
          if (content) {
            as += '\n\n<tool_call>\n<function=' + fn.name + '>\n';
          } else {
            as += '<tool_call>\n<function=' + fn.name + '>\n';
          }
          const args = safeParseArgs(fn.arguments);
          for (const [k, v] of Object.entries(args)) {
            const sv = typeof v === 'object' ? JSON.stringify(v) : String(v);
            as += '<parameter=' + k + '>\n' + sv + '\n</parameter>\n';
          }
          as += '</function>\n</tool_call>\n';
        }
      }
      as += '<|im_end|>\n';
      parts.push(as);
    } else if (msg.role === 'tool') {
      const cLower = content.toLowerCase();
      const isFailure = content.length < 500
        && !content.includes('$ ')
        && !cLower.includes('took ')
        && (cLower.includes('"error":')
          || cLower.includes('error:')
          || cLower.includes('exception:')
          || cLower.includes('traceback')
          || cLower.includes('command not found')
          || cLower.includes('invalid syntax')
          || cLower.includes('failed to'));
      if (isFailure) {
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }

      if (prevRole !== 'tool') {
        parts.push('<|im_start|>user');
      }
      parts.push('\n<tool_response>\n' + content);

      if (consecutiveFailures >= 2) {
        parts.push('\n\n⚠️ SYSTEM WARNING: ' + consecutiveFailures + ' consecutive tool errors detected. Your previous approach is incorrect. You MUST use a fundamentally different approach or corrected arguments.');
      } else if (consecutiveFailures === 1) {
        parts.push('\n\n⚠️ SYSTEM WARNING: The previous tool call returned an error. Diagnose the failure and retry with completely corrected arguments.');
      }

      parts.push('\n</tool_response>');
      const next = msgs[i + 1];
      if (!next || next.role !== 'tool') {
        parts.push('<|im_end|>\n');
      }
    } else {
      parts.push('<|im_start|>user\n[' + msg.role + ']: ' + content + '<|im_end|>\n');
    }

    prevRole = msg.role;
  }

  /* ── generation prompt ── */
  if (addGenerationPrompt) {
    parts.push('<|im_start|>assistant\n');
    if (!thinking || consecutiveFailures >= 2) {
      parts.push('<think>\n</think>\n\n');
    } else {
      parts.push('<think>\n');
    }
  }

  return parts.join('');
}
