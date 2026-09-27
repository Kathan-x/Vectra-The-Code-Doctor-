import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

function zipDir(sourceDir: string, outZipPath: string) {
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(outZipPath);
  console.log(`Created: ${outZipPath} (${fs.statSync(outZipPath).size} bytes)`);
}

const fixturesDir = path.resolve(__dirname, '../../../test-fixtures');
zipDir(path.join(fixturesDir, 'clean-project'), path.join(fixturesDir, 'clean-project.zip'));
zipDir(path.join(fixturesDir, 'risk-project'), path.join(fixturesDir, 'risk-project.zip'));
