import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import fs from 'node:fs';
import path from 'node:path';
import sanitizeFilename from 'sanitize-filename';
import validator from 'validator';
import pino from 'pino';
import { getCopilotClient } from './copilot-loader.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

const MAX_FILE_SIZE = 1024 * 1024;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|commands?)/i,
  /disregard\s+(all\s+)?previous\s+(instructions?|prompts?|commands?)/i,
  /forget\s+(all\s+)?previous\s+(instructions?|prompts?|commands?)/i,
  /new\s+(instructions?|prompts?|commands?):/i,
  /system\s+(prompt|message|instruction):/i,
  /you\s+are\s+now\s+(a|an)/i,
  /from\s+now\s+on\s+you\s+(are|will)/i,
  /\[SYSTEM\]/i,
  /\[ADMIN\]/i,
  /\[OVERRIDE\]/i,
  /<\s*system\s*>/i,
  /<\s*admin\s*>/i,
];

/**
 * Detect and prevent AI prompt injection attempts
 * @param {string} text - Text to validate
 * @returns {Object} Validation result with isValid and reason
 */
function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, reason: 'Invalid input: text must be a non-empty string' };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      logger.warn({ pattern: pattern.source }, 'Potential prompt injection attempt detected');
      return {
        isValid: false,
        reason: 'Instruction contains patterns that could manipulate AI behavior',
      };
    }
  }

  const suspiciousCharCount = (text.match(/[<>{}[\]]/g) || []).length;
  if (suspiciousCharCount > text.length * 0.1) {
    return {
      isValid: false,
      reason: 'Excessive use of special characters detected',
    };
  }

  return { isValid: true };
}

/**
 * Validate and sanitize a filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
function validateFilename(filename) {
  if (!filename || !validator.isLength(filename, { min: 1, max: 255 })) {
    throw new Error('Filename must be between 1 and 255 characters');
  }

  // Check for absolute paths and path traversal BEFORE sanitization
  if (path.isAbsolute(filename)) {
    throw new Error('Absolute paths are not allowed');
  }

  if (filename.includes('..')) {
    throw new Error('Path traversal detected');
  }

  const sanitized = sanitizeFilename(filename, { replacement: '_' });

  if (sanitized !== filename) {
    logger.warn({ original: filename, sanitized }, 'Filename was sanitized');
  }

  return sanitized;
}

/**
 * Validate file safety before reading
 * @param {string} filename - The filename to validate
 * @returns {Promise<string>} Resolved file path
 */
async function validateFile(filename) {
  logger.info({ filename }, 'Validating file');

  const sanitizedFilename = validateFilename(filename);
  const filePath = path.join(process.cwd(), sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${sanitizedFilename}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File ${sanitizedFilename} exceeds maximum size of ${MAX_FILE_SIZE} bytes (actual: ${stats.size} bytes)`
    );
  }

  if (!stats.isFile()) {
    throw new Error(`Path ${sanitizedFilename} is not a file`);
  }

  logger.info({ filePath, size: stats.size }, 'File validated successfully');
  return filePath;
}

/**
 * Run GitHub Copilot SDK with instructions
 * @param {string} token - GitHub token
 * @param {string} instructions - Instructions to follow
 * @param {string|null} instructionFile - Optional file path to attach as context
 * @returns {Promise<void>}
 */
async function runCopilot(token, instructions, instructionFile = null) {
  const injectionCheck = detectPromptInjection(instructions);
  if (!injectionCheck.isValid) {
    logger.error({ reason: injectionCheck.reason }, 'Prompt injection detected');
    throw new Error(`Security: ${injectionCheck.reason}`);
  }

  logger.info('Initializing GitHub Copilot SDK');

  const CopilotClient = await getCopilotClient();

  const client = new CopilotClient({
    logLevel: 'info',
    autoStart: true,
    autoRestart: true,
  });

  try {
    await client.start();
    logger.info('Copilot client started successfully');

    const session = await client.createSession({
      model: 'gpt-5',
      streaming: true,
      onPermissionRequest: async (request) => {
        logger.info({ requestKind: request.kind }, 'Permission requested');

        switch (request.kind) {
          case 'read':
          case 'write':
          case 'shell':
            return { kind: 'approved' };
          default:
            logger.warn({ requestKind: request.kind }, 'Unknown permission request kind');
            return { kind: 'approved' };
        }
      },
    });

    logger.info({ sessionId: session.sessionId }, 'Session created');

    session.on((event) => {
      switch (event.type) {
        case 'assistant.message_delta':
          process.stdout.write(event.data.deltaContent);
          break;
        case 'assistant.message':
          logger.info('Assistant response completed');
          break;
        case 'tool.execution_start':
          logger.info({ toolName: event.data.toolName }, 'Tool execution started');
          break;
        case 'tool.execution_end':
          logger.info({ toolName: event.data.toolName }, 'Tool execution completed');
          break;
        case 'session.error':
          logger.error({ error: event.data.message }, 'Session error');
          break;
      }
    });

    const messageOptions = {
      prompt: instructions,
    };

    if (instructionFile) {
      messageOptions.attachments = [
        {
          type: 'file',
          path: instructionFile,
          displayName: path.basename(instructionFile),
        },
      ];
    }

    logger.info({ instructionsLength: instructions.length }, 'Sending message to Copilot');
    await session.sendAndWait(messageOptions, 300000);

    logger.info('Copilot execution completed successfully');

    await session.destroy();
    await client.stop();
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Copilot SDK execution failed');
    core.warning(`Copilot SDK execution failed: ${error.message}`);

    try {
      await client.forceStop();
    } catch (stopError) {
      logger.error({ error: stopError.message }, 'Failed to stop Copilot client');
    }

    throw error;
  }
}

/**
 * Create a new branch
 * @param {string} branchName - Name of the branch to create
 * @returns {Promise<void>}
 */
async function createBranch(branchName) {
  logger.info({ branchName }, 'Creating new branch');

  try {
    await exec.exec('git', ['checkout', '-b', branchName]);
    logger.info({ branchName }, 'Branch created successfully');
  } catch (error) {
    logger.warn({ branchName, error: error.message }, 'Failed to create branch, trying checkout');
    await exec.exec('git', ['checkout', branchName], { ignoreReturnCode: true });
  }
}

/**
 * Commit and push changes
 * @param {string} message - Commit message
 * @param {string} branch - Branch to push to
 * @returns {Promise<void>}
 */
async function commitAndPush(message, branch) {
  logger.info({ branch, message }, 'Committing and pushing changes');

  try {
    await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
    await exec.exec('git', [
      'config',
      'user.email',
      'github-actions[bot]@users.noreply.github.com',
    ]);

    await exec.exec('git', ['add', '.']);

    const exitCode = await exec.exec('git', ['diff-index', '--quiet', 'HEAD', '--'], {
      ignoreReturnCode: true,
    });

    const hasChanges = exitCode !== 0;

    if (hasChanges) {
      await exec.exec('git', ['commit', '-m', message]);
      await exec.exec('git', ['push', '-u', 'origin', branch]);
      logger.info({ branch }, 'Changes committed and pushed successfully');
    } else {
      logger.info('No changes to commit');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Commit/push failed');
    core.warning(`Commit/push failed: ${error.message}`);
  }
}

/**
 * Create a pull request
 * @param {string} token - GitHub token
 * @param {string} branch - Branch name
 * @param {string} baseBranch - Base branch
 * @param {string} title - PR title
 * @param {string} body - PR body
 * @returns {Promise<number|null>} PR number or null
 */
async function createPullRequest(token, branch, baseBranch, title, body) {
  logger.info({ branch, baseBranch, title }, 'Creating pull request');

  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    const { data: pr } = await octokit.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
      body,
      head: branch,
      base: baseBranch,
    });

    logger.info({ prNumber: pr.number, prUrl: pr.html_url }, 'Pull request created successfully');
    return pr.number;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create PR');
    core.error(`Failed to create PR: ${error.message}`);
    return null;
  }
}

/**
 * Assign the PR to the actor
 * @param {string} token - GitHub token
 * @param {number} prNumber - PR number
 * @returns {Promise<void>}
 */
async function assignPR(token, prNumber) {
  logger.info({ prNumber }, 'Assigning PR to actor');

  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    await octokit.rest.issues.addAssignees({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      assignees: [context.actor],
    });

    logger.info({ prNumber, actor: context.actor }, 'PR assigned successfully');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to assign PR');
    core.warning(`Failed to assign PR: ${error.message}`);
  }
}

/**
 * Main action entry point
 */
async function run() {
  try {
    const privateToken = core.getInput('PRIVATE_TOKEN', { required: true });
    const filename = core.getInput('filename', { required: false });
    const baseBranch = core.getInput('branch', { required: false }) || 'main';

    const { context } = github;
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const newBranch = `copilot/delegate-${timestamp}`;

    logger.info(
      {
        repository: `${context.repo.owner}/${context.repo.repo}`,
        baseBranch,
        newBranch,
        actor: context.actor,
      },
      'Starting delegate action workflow'
    );

    let instructions = 'Analyze the repository and suggest improvements';
    let instructionFilePath = null;

    if (filename) {
      try {
        instructionFilePath = await validateFile(filename);
        const fileContent = fs.readFileSync(instructionFilePath, 'utf8');
        instructions = fileContent;
        logger.info(
          { filename, instructionsLength: instructions.length },
          'Loaded instructions from file'
        );
      } catch (error) {
        logger.error({ filename, error: error.message }, 'Failed to load instructions file');
        core.setFailed(`Failed to load instructions file: ${error.message}`);
        return;
      }
    }

    await runCopilot(privateToken, instructions, instructionFilePath);
    await createBranch(newBranch);
    await commitAndPush(
      `feat: delegate action changes\n\nGenerated with GitHub Copilot as directed by @${context.actor}`,
      newBranch
    );

    const reviewInstructions = `Review the changes in branch ${newBranch}, create documentation for new features, and suggest test cases`;
    await runCopilot(privateToken, reviewInstructions);
    await commitAndPush(
      `docs: add documentation and tests\n\nGenerated with GitHub Copilot as directed by @${context.actor}`,
      newBranch
    );

    const promptFileSection = filename ? `**Prompt file:** \`${filename}\`\n\n` : '';
    const prBody =
      `## Automated changes by Delegate Action\n\n` +
      `This PR was automatically created by the delegate-action.\n\n` +
      promptFileSection +
      `**Base branch:** \`${baseBranch}\`\n` +
      `**Created by:** @${context.actor}\n\n` +
      `Please review the changes carefully before merging.\n\n` +
      `---\n\n` +
      `_Generated with GitHub Copilot as directed by @${context.actor}_`;

    const prNumber = await createPullRequest(
      privateToken,
      newBranch,
      baseBranch,
      `Delegate: ${filename || 'Repository changes'}`,
      prBody
    );

    if (prNumber) {
      await assignPR(privateToken, prNumber);
      core.setOutput('pr_number', prNumber);
      core.setOutput('branch', newBranch);
      logger.info({ prNumber, branch: newBranch }, 'Delegate action completed successfully');
    }
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Action failed');
    core.setFailed(`Action failed: ${error.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}

export {
  detectPromptInjection,
  validateFilename,
  validateFile,
  runCopilot,
  createBranch,
  commitAndPush,
  createPullRequest,
  assignPR,
  run,
};
