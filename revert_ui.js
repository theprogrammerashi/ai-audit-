const fs = require('fs');
const path = require('path');
const raw = fs.readFileSync('reverts.json', 'utf16le').replace(/^\uFEFF/, '');
const replaces = JSON.parse(raw);

const uiReplaces = replaces.filter(r => !r.args.TargetFile.includes('backend') && r.args.TargetFile.includes('frontend'));

for (const r of uiReplaces) {
  if (r.name === 'multi_replace_file_content' || r.name === 'replace_file_content') {
    let filePath = r.args.TargetFile;
    if (filePath.startsWith('"')) filePath = JSON.parse(filePath);
    
    let newContent = fs.readFileSync(filePath, 'utf8');
    let chunks = [];
    if (r.args.ReplacementChunks) {
      chunks = JSON.parse(r.args.ReplacementChunks.replace(/\n/g, '\\n'));
    } else if (r.args.ReplacementContent) {
      chunks = [{ TargetContent: r.args.TargetContent, ReplacementContent: r.args.ReplacementContent }];
    }
    
    for (const chunk of chunks) {
      let oldStr = chunk.TargetContent;
      let newStr = chunk.ReplacementContent;
      // Undo
      newContent = newContent.replace(newStr, oldStr);
    }
    
    fs.writeFileSync(filePath, newContent);
    console.log('Reverted UI ' + filePath);
  }
}
