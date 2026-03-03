#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');

const DEFAULT_REPO = 'zhimingdeng/clawsc';

function parseArgs(argv) {
  const result = { repo: '', strict: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }

    if (arg === '--strict') {
      result.strict = true;
      continue;
    }

    if (arg === '--repo') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --repo');
      }
      result.repo = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (result.repo && !result.repo.includes('/')) {
    throw new Error('Invalid --repo format, expected owner/repo');
  }

  return result;
}

function usage() {
  console.log(`Usage: node scripts/github-preflight.mjs [options]

Options:
  --repo <owner/repo>   Expected GitHub repo slug for URL validation
  --strict              Fail when warnings are found
  --help                Show help
`);
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function pathExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function hasExecutableBit(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  try {
    const stat = fs.statSync(fullPath);
    return Boolean(stat.mode & 0o111);
  } catch {
    return false;
  }
}

function printSection(title, rows) {
  if (rows.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const row of rows) {
    console.log(`- ${row}`);
  }
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    usage();
    process.exit(1);
  }

  if (args.help) {
    usage();
    process.exit(0);
  }

  const passes = [];
  const warnings = [];
  const errors = [];

  const requiredFiles = [
    'LICENSE',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'CHANGELOG.md',
    'RELEASE.md',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    '.github/workflows/security.yml',
    '.github/dependabot.yml',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.release-please-config.json',
    '.release-please-manifest.json',
    'scripts/install.sh',
  ];

  for (const file of requiredFiles) {
    if (pathExists(file)) {
      passes.push(`Found ${file}`);
    } else {
      errors.push(`Missing required file: ${file}`);
    }
  }

  if (pathExists('scripts/install.sh')) {
    if (hasExecutableBit('scripts/install.sh')) {
      passes.push('scripts/install.sh is executable');
    } else {
      warnings.push('scripts/install.sh is not executable');
    }
  }

  const repoToCheck = args.repo || process.env.GITHUB_REPOSITORY || '';
  const readme = readFileSafe(path.join(rootDir, 'README.md'));
  const installDoc = readFileSafe(path.join(rootDir, 'docs/install.md'));
  const issueConfig = readFileSafe(path.join(rootDir, '.github/ISSUE_TEMPLATE/config.yml'));

  if (readme.includes('--repo')) {
    passes.push('README includes one-click installer repo argument');
  } else {
    warnings.push('README one-click installer is missing --repo guidance');
  }

  const hardcodedRepoHits = [
    ['README.md', readme.includes(DEFAULT_REPO)],
    ['docs/install.md', installDoc.includes(DEFAULT_REPO)],
    ['.github/ISSUE_TEMPLATE/config.yml', issueConfig.includes(DEFAULT_REPO)],
  ].filter(([, found]) => found).map(([file]) => file);

  if (hardcodedRepoHits.length > 0) {
    if (repoToCheck && repoToCheck !== DEFAULT_REPO) {
      warnings.push(
        `Repo slug mismatch: found ${DEFAULT_REPO} in ${hardcodedRepoHits.join(', ')}; expected ${repoToCheck}`,
      );
    } else if (!repoToCheck) {
      warnings.push(
        `Hardcoded repo slug (${DEFAULT_REPO}) found in ${hardcodedRepoHits.join(', ')}. If publishing elsewhere, replace it.`,
      );
    } else {
      passes.push(`Repo slug matches expected value (${DEFAULT_REPO})`);
    }
  }

  if (repoToCheck) {
    passes.push(`Validated against repo: ${repoToCheck}`);
  } else {
    warnings.push('No --repo provided. Pass --repo owner/repo for strict URL validation.');
  }

  console.log('Voice Hub GitHub Preflight Report');
  console.log(`Root: ${rootDir}`);

  printSection('PASS', passes);
  printSection('WARN', warnings);
  printSection('ERROR', errors);

  console.log(`\nSummary: ${passes.length} pass, ${warnings.length} warn, ${errors.length} error`);

  if (errors.length > 0) {
    process.exit(1);
  }

  if (warnings.length > 0 && args.strict) {
    process.exit(2);
  }
}

main();
