const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

// Configuration constants
const MAX_INSTRUCTION_LENGTH = 500;
const COPILOT_SUGGEST_TYPE = 'shell';

/**
 * Sanitize a file to prevent security issues
 * @param {string} filename - The file to sanitize
 * @returns {Promise<void>}
 */
async function sanitizeFile(filename) {
  core.info(`Sanitizing file: ${filename}`);

  if (!filename || filename === '') {
    core.info('No filename provided, skipping sanitization');
    return;
  }

  // Validate filename doesn't contain dangerous patterns
  const dangerousPatterns = [
    /\.\./, // Directory traversal
    /^\//, // Absolute paths
    /[<>:"|?*]/, // Invalid filename characters
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(filename)) {
      throw new Error(`Invalid filename: ${filename} contains dangerous pattern`);
    }
  }

  // Check if file exists
  const filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    core.info(`File exists: ${filePath}`);

    // Basic sanitization: trim whitespace, validate content
    const content = fs.readFileSync(filePath, 'utf8');
    const sanitized = content.trim();

    if (content !== sanitized) {
      fs.writeFileSync(filePath, sanitized, 'utf8');
      core.info('File sanitized: removed leading/trailing whitespace');
    }
  } else {
    core.warning(`File not found: ${filePath}`);
  }
}

/**
 * Run GitHub Copilot CLI command
 * @param {string} token - GitHub token
 * @param {string} baseRef - Base reference
 * @param {string} instructions - Instructions to follow
 * @returns {Promise<void>}
 */
async function runCopilot(token, baseRef, instructions) {
  core.info(`Running Copilot CLI with base ref: ${baseRef}`);

  try {
    // Check if GitHub Copilot CLI is installed
    let isInstalled = false;
    await exec.exec('gh', ['extension', 'list'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data) => {
          const output = data.toString();
          if (output.includes('gh-copilot')) {
            isInstalled = true;
          }
        },
      },
    });

    // Install if not available
    if (!isInstalled) {
      core.info('Installing GitHub Copilot CLI extension');
      try {
        await exec.exec('gh', ['extension', 'install', 'github/gh-copilot']);
        core.info('GitHub Copilot CLI extension installed successfully');
      } catch (installError) {
        core.warning(`Failed to install Copilot CLI: ${installError.message}`);
        return;
      }
    }

    // Run copilot command - using suggest for demonstration
    // Note: In production, this would interact with the Copilot CLI more effectively
    const args = ['copilot', 'suggest', '-t', COPILOT_SUGGEST_TYPE, instructions];
    await exec.exec('gh', args, {
      env: {
        ...process.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
      },
    });
  } catch (error) {
    core.warning(`Copilot CLI execution failed: ${error.message}`);
  }
}

/**
 * Create a new branch
 * @param {string} branchName - Name of the branch to create
 * @returns {Promise<void>}
 */
async function createBranch(branchName) {
  core.info(`Creating new branch: ${branchName}`);

  try {
    await exec.exec('git', ['checkout', '-b', branchName]);
    core.info(`Branch ${branchName} created successfully`);
  } catch (error) {
    core.warning(`Failed to create branch: ${error.message}`);
    // Try to checkout existing branch
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
  core.info('Committing and pushing changes');

  try {
    // Configure git
    await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
    await exec.exec('git', [
      'config',
      'user.email',
      'github-actions[bot]@users.noreply.github.com',
    ]);

    // Add all changes
    await exec.exec('git', ['add', '.']);

    // Check if there are changes to commit using git diff-index
    let hasChanges = false;
    const exitCode = await exec.exec('git', ['diff-index', '--quiet', 'HEAD', '--'], {
      ignoreReturnCode: true,
    });

    // Non-zero exit code means there are changes
    hasChanges = exitCode !== 0;

    if (hasChanges) {
      await exec.exec('git', ['commit', '-m', message]);
      await exec.exec('git', ['push', '-u', 'origin', branch]);
      core.info('Changes committed and pushed successfully');
    } else {
      core.info('No changes to commit');
    }
  } catch (error) {
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
  core.info('Creating pull request');

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

    core.info(`Pull request created: #${pr.number}`);
    return pr.number;
  } catch (error) {
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
  core.info(`Assigning PR #${prNumber} to actor`);

  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    await octokit.rest.issues.addAssignees({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      assignees: [context.actor],
    });

    core.info(`PR assigned to ${context.actor}`);
  } catch (error) {
    core.warning(`Failed to assign PR: ${error.message}`);
  }
}

/**
 * Main action entry point
 */
async function run() {
  try {
    // Get inputs
    const privateToken = core.getInput('PRIVATE_TOKEN', { required: true });
    const filename = core.getInput('filename', { required: false });
    const baseBranch = core.getInput('branch', { required: false }) || 'main';

    const { context } = github;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newBranch = `copilot/delegate-${timestamp}`;

    core.info('Starting delegate action workflow');
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`Base branch: ${baseBranch}`);
    core.info(`New branch: ${newBranch}`);

    // Step 1: Sanitize file
    if (filename) {
      await sanitizeFile(filename);
    }

    // Step 2: Run copilot with base ref
    // Build more specific instructions
    let instructions = 'Analyze the repository and suggest improvements';
    if (filename) {
      const filePath = path.join(process.cwd(), filename);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        instructions = `Process the following instructions from ${filename}:\n${fileContent.substring(0, MAX_INSTRUCTION_LENGTH)}`;
      } else {
        instructions = `Follow instructions in ${filename}`;
      }
    }

    await runCopilot(privateToken, baseBranch, instructions);

    // Step 3: Create new branch
    await createBranch(newBranch);

    // Step 4: Commit and push
    await commitAndPush(`feat: delegate action changes for ${filename || 'repository'}`, newBranch);

    // Step 5: Run copilot for review/docs/tests
    core.info('Running Copilot for review, documentation, and tests');
    const reviewInstructions = `Review the changes in branch ${newBranch}, create documentation for new features, and suggest test cases`;
    await runCopilot(privateToken, baseBranch, reviewInstructions);

    // Commit additional changes
    await commitAndPush('docs: add documentation and tests', newBranch);

    // Step 6: Create PR
    const prNumber = await createPullRequest(
      privateToken,
      newBranch,
      baseBranch,
      `🤖 Delegate: ${filename || 'Repository changes'}`,
      `## Automated changes by Delegate Action\n\n` +
        `This PR was automatically created by the delegate-action.\n\n` +
        `${filename ? `**File processed:** \`${filename}\`\n\n` : ''}` +
        `**Base branch:** \`${baseBranch}\`\n` +
        `**Created by:** @${context.actor}\n\n` +
        `Please review the changes carefully before merging.`
    );

    // Step 7: Assign actor
    if (prNumber) {
      await assignPR(privateToken, prNumber);
      core.setOutput('pr_number', prNumber);
      core.setOutput('branch', newBranch);
    }

    core.info('Delegate action completed successfully');
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

// Run the action
run();
