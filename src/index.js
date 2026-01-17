const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const sanitizeFilename = require('sanitize-filename');
const validator = require('validator');
const pino = require('pino');

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

const MAX_INSTRUCTION_LENGTH = 500;
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Validate and sanitize a filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
function validateFilename(filename) {
  if (!filename || !validator.isLength(filename, { min: 1, max: 255 })) {
    throw new Error('Filename must be between 1 and 255 characters');
  }

  const sanitized = sanitizeFilename(filename, { replacement: '_' });

  if (sanitized !== filename) {
    logger.warn({ original: filename, sanitized }, 'Filename was sanitized');
  }

  if (path.isAbsolute(sanitized)) {
    throw new Error('Absolute paths are not allowed');
  }

  if (sanitized.includes('..')) {
    throw new Error('Path traversal detected');
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
 * Run GitHub Copilot CLI command
 * @param {string} token - GitHub token
 * @param {string} instructions - Instructions to follow
 * @returns {Promise<void>}
 */
async function runCopilot(token, instructions) {
  logger.info('Checking GitHub Copilot CLI installation');

  try {
    let copilotVersion = '';
    await exec.exec('npx', ['@github/copilot', '--version'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data) => {
          copilotVersion = data.toString().trim();
        },
      },
    });

    if (copilotVersion) {
      logger.info({ version: copilotVersion }, 'GitHub Copilot CLI is available');
    } else {
      logger.warn('GitHub Copilot CLI not found, installing...');
      await exec.exec('npm', ['install', '-g', '@github/copilot']);
      logger.info('GitHub Copilot CLI installed successfully');
    }

    logger.info({ instructionsLength: instructions.length }, 'Executing Copilot CLI');

    await exec.exec('npx', ['@github/copilot'], {
      input: Buffer.from(instructions),
      env: {
        ...process.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
      },
    });

    logger.info('Copilot CLI execution completed');
  } catch (error) {
    logger.error({ error: error.message }, 'Copilot CLI execution failed');
    core.warning(`Copilot CLI execution failed: ${error.message}`);
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
      title: title,
      body: body,
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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

    if (filename) {
      try {
        const filePath = await validateFile(filename);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        instructions = `Process the following instructions from ${filename}:\n${fileContent.substring(0, MAX_INSTRUCTION_LENGTH)}`;
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

    await runCopilot(privateToken, instructions);
    await createBranch(newBranch);
    await commitAndPush(`feat: delegate action changes for ${filename || 'repository'}`, newBranch);

    const reviewInstructions = `Review the changes in branch ${newBranch}, create documentation for new features, and suggest test cases`;
    await runCopilot(privateToken, reviewInstructions);
    await commitAndPush('docs: add documentation and tests', newBranch);

    const prNumber = await createPullRequest(
      privateToken,
      newBranch,
      baseBranch,
      `Delegate: ${filename || 'Repository changes'}`,
      `## Automated changes by Delegate Action\n\n` +
        `This PR was automatically created by the delegate-action.\n\n` +
        `${filename ? `**File processed:** \`${filename}\`\n\n` : ''}` +
        `**Base branch:** \`${baseBranch}\`\n` +
        `**Created by:** @${context.actor}\n\n` +
        `Please review the changes carefully before merging.`
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

run();
