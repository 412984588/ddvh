/**
 * Doctor command - Diagnostics for Voice Hub
 */

export interface PluginContext {
  cwd: string;
  env: Record<string, string>;
  exec: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

/**
 * Run comprehensive diagnostics
 */
export async function doctor(context: PluginContext): Promise<string> {
  const results: string[] = [];
  results.push('# Voice Hub Diagnostics\n');

  // 1. Environment check
  results.push('## Environment Variables');
  results.push(checkEnvironment(context.env));
  results.push('');

  // 2. Dependencies check
  results.push('## Dependencies');
  const depResult = await checkDependencies(context);
  results.push(depResult);
  results.push('');

  // 3. Build status
  results.push('## Build Status');
  const buildResult = await checkBuild(context);
  results.push(buildResult);
  results.push('');

  // 4. Configuration validation
  results.push('## Configuration');
  const configResult = await checkConfiguration(context);
  results.push(configResult);
  results.push('');

  // 5. Recommendations
  results.push('## Recommendations');
  results.push(generateRecommendations(results));

  return results.join('\n');
}

/**
 * Check environment variables
 */
function checkEnvironment(env: Record<string, string>): string {
  const required: Record<string, string> = {
    DISCORD_BOT_TOKEN: 'Discord bot token',
    DISCORD_CLIENT_ID: 'Discord client ID',
    VOLCENGINE_OMNI_ENDPOINT: 'Volcengine Omni endpoint',
    VOLCENGINE_OMNI_API_KEY: 'Volcengine Omni API key',
    VOLCENGINE_OMNI_MODEL: 'Volcengine Omni model name',
  };

  const checks: string[] = [];

  for (const [key, description] of Object.entries(required)) {
    const value = env[key];
    if (value) {
      // Show partial value for security
      const display =
        key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY')
          ? `${value.slice(0, 8)}...`
          : value;
      checks.push(`  ✅ ${key} (${description}): ${display}`);
    } else {
      checks.push(`  ❌ ${key} (${description}): Not set`);
    }
  }

  return checks.join('\n');
}

/**
 * Check dependencies
 */
async function checkDependencies(context: PluginContext): Promise<string> {
  try {
    const { stdout } = await context.exec('pnpm list --depth=0 2>&1');

    const checks: string[] = [];

    const dependencies = [
      { name: 'discord.js', required: true },
      { name: '@discordjs/voice', required: true },
      { name: '@voice-hub/shared-config', required: true },
      { name: '@voice-hub/audio-engine', required: true },
      { name: '@voice-hub/provider-volcengine-omni', required: true },
      { name: '@voice-hub/memory-bank', required: true },
      { name: '@voice-hub/backend-dispatcher', required: true },
      { name: '@voice-hub/core-runtime', required: true },
    ];

    for (const dep of dependencies) {
      const installed = stdout.includes(dep.name);
      checks.push(installed ? `  ✅ ${dep.name}` : `  ❌ ${dep.name} (required)`);
    }

    return checks.join('\n');
  } catch (error) {
    return `  ⚠️ Could not check dependencies: ${error}`;
  }
}

/**
 * Check build status
 */
async function checkBuild(context: PluginContext): Promise<string> {
  try {
    // Check if dist directories exist
    const { stdout } = await context.exec('find packages apps -name "dist" -type d 2>/dev/null');

    const built = stdout.trim().split('\n').filter(Boolean);
    const total = 8; // Total packages to build

    return `  Built ${built.length}/${total} packages\n${
      built.length < total
        ? '  ⚠️ Some packages not built. Run: pnpm build'
        : '  ✅ All packages built'
    }`;
  } catch {
    return '  ⚠️ Could not check build status';
  }
}

/**
 * Check configuration validity
 */
async function checkConfiguration(context: PluginContext): Promise<string> {
  const checks: string[] = [];

  // Validate Omni endpoint format
  const endpoint = context.env.VOLCENGINE_OMNI_ENDPOINT;
  if (endpoint) {
    try {
      new URL(endpoint);
      checks.push('  ✅ Omni endpoint format valid');
    } catch {
      checks.push('  ❌ Omni endpoint format invalid');
    }
  }

  // Validate port numbers
  const webhookPort = context.env.BACKEND_WEBHOOK_PORT;
  if (webhookPort) {
    const port = parseInt(webhookPort, 10);
    checks.push(
      port > 0 && port < 65536
        ? `  ✅ Webhook port valid: ${port}`
        : `  ❌ Webhook port invalid: ${webhookPort}`
    );
  }

  // Validate audio config
  const sampleRate = context.env.AUDIO_SAMPLE_RATE;
  if (sampleRate) {
    const rate = parseInt(sampleRate, 10);
    checks.push(
      rate === 16000 || rate === 48000
        ? `  ✅ Sample rate valid: ${rate}Hz`
        : `  ⚠️ Sample rate unusual: ${rate}Hz (expected 16000 or 48000)`
    );
  }

  return checks.length > 0 ? checks.join('\n') : '  ℹ️ No configuration to check';
}

/**
 * Generate recommendations based on results
 */
function generateRecommendations(results: string[]): string {
  const recommendations: string[] = [];

  // Check for common issues
  const allOutput = results.join('\n');

  if (allOutput.includes('❌')) {
    recommendations.push('1. Fix all failed checks above before starting the daemon.');
  }

  if (allOutput.includes('Not set')) {
    recommendations.push('2. Set missing environment variables in .env file (see .env.example).');
  }

  if (allOutput.includes('not built')) {
    recommendations.push('3. Build all packages: pnpm build');
  }

  if (recommendations.length === 0) {
    recommendations.push(
      '✅ All checks passed! You can start the daemon with: pnpm --filter @voice-hub/bridge-daemon start'
    );
  }

  return recommendations.map((r) => `  ${r}`).join('\n');
}
