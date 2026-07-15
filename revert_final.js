const fs = require('fs');

const transcriptRaw = fs.readFileSync('C:/Users/HP/.gemini/antigravity/brain/63ce00b0-85fe-4aa8-a66e-ffab813aa100/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = transcriptRaw.trim().split('\n');
const replaces = lines
  .map(l => { try { return JSON.parse(l); } catch(e){return null;} })
  .filter(o => o && o.type === 'PLANNER_RESPONSE' && o.tool_calls)
  .flatMap(o => o.tool_calls)
  .filter(t => t.name === 'multi_replace_file_content' || t.name === 'replace_file_content');

// Get the last N replaces (e.g. last 30) that belong to frontend
const uiReplaces = replaces.filter(r => r.args && r.args.TargetFile && !r.args.TargetFile.includes('backend') && r.args.TargetFile.includes('frontend')).slice(-30);

for (let i = uiReplaces.length - 1; i >= 0; i--) {
  const r = uiReplaces[i];
  let filePath = r.args.TargetFile;
  if (filePath.startsWith('"')) filePath = JSON.parse(filePath);
  
  if (!fs.existsSync(filePath)) continue;

  let newContent = fs.readFileSync(filePath, 'utf8');
  let chunks = [];
  
  if (r.args.ReplacementChunks) {
    let chunksStr = r.args.ReplacementChunks;
    if (typeof chunksStr === 'string') {
        if (chunksStr.startsWith('"')) chunksStr = JSON.parse(chunksStr);
        // Fix bad control characters
        chunksStr = chunksStr.replace(/[\u0000-\u001F]/g, function (c) {
            return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
        });
        chunks = JSON.parse(chunksStr);
    } else {
        chunks = chunksStr;
    }
  } else if (r.args.ReplacementContent) {
    chunks = [{ TargetContent: r.args.TargetContent, ReplacementContent: r.args.ReplacementContent }];
  }
  
  let didRevert = false;
  for (const chunk of chunks) {
    let oldStr = chunk.TargetContent;
    let newStr = chunk.ReplacementContent;
    // Apply revert
    if (newContent.includes(newStr)) {
      newContent = newContent.replace(newStr, oldStr);
      didRevert = true;
    }
  }
  
  if (didRevert) {
    fs.writeFileSync(filePath, newContent);
    console.log('Reverted UI: ' + filePath);
  } else {
    console.log('Skip or already reverted: ' + filePath);
  }
}
