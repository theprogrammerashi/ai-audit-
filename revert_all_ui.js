const fs = require('fs');

const transcriptRaw = fs.readFileSync('C:/Users/HP/.gemini/antigravity/brain/63ce00b0-85fe-4aa8-a66e-ffab813aa100/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = transcriptRaw.trim().split('\n');
const replaces = lines
  .map(l => { try { return JSON.parse(l); } catch(e){return null;} })
  .filter(o => o && o.type === 'PLANNER_RESPONSE' && o.tool_calls)
  .flatMap(o => o.tool_calls)
  .filter(t => t.name === 'multi_replace_file_content' || t.name === 'replace_file_content')
  .slice(-20); // Get the last 20 replace calls

const uiReplaces = replaces.filter(r => !r.args.TargetFile.includes('backend') && r.args.TargetFile.includes('frontend'));

for (let i = uiReplaces.length - 1; i >= 0; i--) {
  const r = uiReplaces[i];
  let filePath = r.args.TargetFile;
  if (filePath.startsWith('"')) filePath = JSON.parse(filePath);
  
  if (!fs.existsSync(filePath)) continue;

  let newContent = fs.readFileSync(filePath, 'utf8');
  let chunks = [];
  
  if (r.args.ReplacementChunks) {
    let chunksStr = r.args.ReplacementChunks;
    if (chunksStr.startsWith('"')) chunksStr = JSON.parse(chunksStr);
    chunks = typeof chunksStr === 'string' ? JSON.parse(chunksStr) : chunksStr;
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
