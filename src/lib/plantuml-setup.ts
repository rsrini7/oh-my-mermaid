import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PLANTUML_VERSION = '1.2026.6';
const PLANTUML_URL = `https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml-${PLANTUML_VERSION}.jar`;
const PLANTUML_DIR = path.join(os.homedir(), '.omnimap');
const PLANTUML_JAR = path.join(PLANTUML_DIR, 'plantuml.jar');

/**
 * Get the path to plantuml.jar, downloading if needed.
 * Returns null if Java is not available.
 */
export async function ensurePlantUML(): Promise<string | null> {
  if (!isJavaAvailable()) return null;
  if (fs.existsSync(PLANTUML_JAR)) return PLANTUML_JAR;
  return await downloadPlantUML();
}

/**
 * Check if Java is installed
 */
export function isJavaAvailable(): boolean {
  try {
    execSync('java -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download PlantUML jar to ~/.omnimap/
 */
export async function downloadPlantUML(): Promise<string | null> {
  if (!fs.existsSync(PLANTUML_DIR)) {
    fs.mkdirSync(PLANTUML_DIR, { recursive: true });
  }

  const hasCurl = (() => { try { execSync('command -v curl', { stdio: 'ignore' }); return true; } catch { return false; } })();
  const hasWget = (() => { try { execSync('command -v wget', { stdio: 'ignore' }); return true; } catch { return false; } })();

  if (!hasCurl && !hasWget) {
    process.stderr.write('warning: curl or wget required to download PlantUML.\n');
    return null;
  }

  process.stderr.write(`Downloading PlantUML v${PLANTUML_VERSION} to ${PLANTUML_JAR}...\n`);

  try {
    if (hasCurl) {
      execSync(`curl -L -o "${PLANTUML_JAR}" "${PLANTUML_URL}"`, { stdio: 'ignore' });
    } else {
      execSync(`wget -O "${PLANTUML_JAR}" "${PLANTUML_URL}"`, { stdio: 'ignore' });
    }

    const stats = fs.statSync(PLANTUML_JAR);
    if (stats.size < 1000000) {
      fs.unlinkSync(PLANTUML_JAR);
      process.stderr.write('warning: Download incomplete.\n');
      return null;
    }

    process.stderr.write(`Done! Saved to ${PLANTUML_JAR}\n`);
    return PLANTUML_JAR;
  } catch (err: any) {
    process.stderr.write(`warning: Download failed: ${err.message}\n`);
    return null;
  }
}

/**
 * Get the configured plantuml.jar path
 */
export function getConfiguredPlantUMLJar(): string | null {
  // Check config.yaml
  try {
    const YAML = require('yaml');
    const ommDir = path.join(process.cwd(), '.omm');
    const configPath = path.join(ommDir, 'config.yaml');
    if (fs.existsSync(configPath)) {
      const config = YAML.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config?.plantuml_jar && fs.existsSync(config.plantuml_jar)) {
        return config.plantuml_jar;
      }
    }
  } catch { /* ignore */ }

  // Check auto-downloaded
  if (fs.existsSync(PLANTUML_JAR)) return PLANTUML_JAR;
  return null;
}

/**
 * Get status info
 */
export function getPlantUMLStatus(): { available: boolean; path?: string; java: boolean } {
  const java = isJavaAvailable();
  const jar = getConfiguredPlantUMLJar();
  return { available: java && !!jar, path: jar || undefined, java };
}
