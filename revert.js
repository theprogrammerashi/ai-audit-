const fs = require('fs');
const path = require('path');
const raw = fs.readFileSync('reverts.json', 'utf16le').replace(/^\uFEFF/, '');
const replaces = JSON.parse(raw);

for (const r of replaces) {
  if (r.name === 'multi_replace_file_content' || r.name === 'replace_file_content') {
    const filePath = r.args.TargetFile; // It's just a string because JSON parsing already unwrapped the outer string? No, args is an object of strings if not properly parsed.
    // wait, r.args.TargetFile is a string because JSON.stringify inside node generated it.
    let parsedFilePath = filePath;
    if (filePath.startsWith('"')) parsedFilePath = JSON.parse(filePath);

    let newContent = fs.readFileSync(parsedFilePath, 'utf8');
    
    let chunks = [];
    if (r.args.ReplacementChunks) {
      chunks = JSON.parse(r.args.ReplacementChunks);
    } else if (r.args.ReplacementContent) {
      chunks = [{ TargetContent: r.args.TargetContent, ReplacementContent: r.args.ReplacementContent }];
    } else {
      continue;
    }
    
    for (const chunk of chunks) {
      let oldStr = chunk.TargetContent;
      let newStr = chunk.ReplacementContent;
      newContent = newContent.replace(newStr, oldStr);
    }
    
    fs.writeFileSync(parsedFilePath, newContent);
    console.log('Reverted ' + parsedFilePath);
  }
}
