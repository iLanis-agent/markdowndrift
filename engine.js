/* MarkdownDrift engine - detects Markdown constructs where flavors disagree.
   Flavor columns: CommonMark 0.31.2 (spec sections cited), GFM (CM + extensions),
   Python-Markdown 3.x (VERIFIED against the real library by tests/oracle.py),
   markdown.pl (historical reference behavior). Not a renderer: a trap detector. */
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MD = factory();
})(typeof self !== 'undefined' ? self : this, function(){
'use strict';

/* outcome vocab: literal, paragraph, heading, em, list, list-start-N, code-block,
   inline-code-span, link, del, table, nested, sibling, checkbox, literal-marker */

var CONSTRUCTS = {
 'intraword-underscore': {
   name:'Intraword underscore',
   explain:'An underscore between word characters. CommonMark 0.31.2 section 6.2 forbids intraword emphasis with _, so foo_bar_baz stays literal. Original markdown.pl happily italicized the middle of your words (snake_case variables were notorious).',
   outcomes:{cm:'literal', gfm:'literal', pm:'literal', pl:'em'}},
 'hash-no-space': {
   name:'# without a space',
   explain:'#foo: CommonMark section 4.2 requires a space (or end of line) after the opening #s, so it is a paragraph. Python-Markdown and original markdown.pl make it a level-1 heading. GitHub hashtags in docs break silently under the lenient parsers.',
   outcomes:{cm:'paragraph', gfm:'paragraph', pm:'heading', pl:'heading'}},
 'ordered-paren': {
   name:'1) marker',
   explain:'A closing parenthesis is a legal ordered-list marker in CommonMark section 5.3 (and GFM). Python-Markdown and markdown.pl only accept the dot, so your numbered list becomes a plain paragraph.',
   outcomes:{cm:'list', gfm:'list', pm:'paragraph', pl:'paragraph'}},
 'ordered-start': {
   name:'Start number',
   explain:'A list starting at 5. keeps its number: CommonMark section 5.3 emits <ol start="5">. Python-Markdown and markdown.pl silently renumber from 1 - your "items 5-8" become "items 1-4".',
   outcomes:{cm:'list-start-N', gfm:'list-start-N', pm:'list-no-start', pl:'list-no-start'}},
 'ordered-interrupt-2plus': {
   name:'List interrupts paragraph (2+)',
   explain:'An ordered list can only interrupt a paragraph when it starts at 1 (CommonMark section 5.3 - a "2." mid-paragraph is usually a sentence, not a list). Python-Markdown 3.x also refuses. Original markdown.pl interrupted on any number.',
   outcomes:{cm:'paragraph', gfm:'paragraph', pm:'paragraph', pl:'list'}},
 'ordered-interrupt-1': {
   name:'List interrupts paragraph (1.)',
   explain:'A 1. list MAY interrupt a paragraph in CommonMark and GFM. Python-Markdown 3.x refuses to interrupt at all, so the "list" stays inside the paragraph. Insert a blank line to be safe everywhere.',
   outcomes:{cm:'list', gfm:'list', pm:'paragraph', pl:'list'}},
 'fence': {
   name:'Fenced code block',
   explain:'Triple backticks are a fenced code block in CommonMark section 4.5 and GFM. Python-Markdown core has no fence support (needs the fenced_code extension): the backticks collapse into an inline code span. markdown.pl shows them literally.',
   outcomes:{cm:'code-block', gfm:'code-block', pm:'inline-code-span', pl:'literal'}},
 'bare-url': {
   name:'Bare URL',
   explain:'A naked http:// URL stays literal text in CommonMark (autolinks need <angle brackets>, section 6.5) and in Python-Markdown. GFM autolink extension turns it into a link. Paste CM/GFM docs into a PM pipeline and every link dies.',
   outcomes:{cm:'literal', gfm:'link', pm:'literal', pl:'literal'}},
 'strikethrough': {
   name:'~~Strikethrough~~',
   explain:'~~text~~ is a GFM extension (section 6.5 extension) rendering <del>. CommonMark, Python-Markdown core and markdown.pl leave the tildes literal.',
   outcomes:{cm:'literal', gfm:'del', pm:'literal', pl:'literal'}},
 'table': {
   name:'Pipe table',
   explain:'Pipe tables exist only in GFM (extension). CommonMark has no tables at all, and Python-Markdown needs the tables extension; otherwise the whole grid is one literal paragraph of pipes.',
   outcomes:{cm:'literal', gfm:'table', pm:'literal', pl:'literal'}},
 'sublist-indent-2': {
   name:'Two-space sub-list',
   explain:'CommonMark section 5.3 nests a sub-list indented to just past the parent marker (2 spaces for "* "). Python-Markdown and markdown.pl demand a full 4-space indent; with 2 spaces your "nested" items become siblings at the top level.',
   outcomes:{cm:'nested', gfm:'nested', pm:'sibling', pl:'sibling'}},
 'task-list': {
   name:'Task list checkbox',
   explain:'- [ ] and - [x] become real disabled checkboxes only in GFM (task list extension). Everywhere else the brackets are literal text inside the list item.',
   outcomes:{cm:'literal-marker', gfm:'checkbox', pm:'literal-marker', pl:'literal-marker'}}
};

function detect(lines){
  var findings=[];
  var inFence=false;
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    if(/^\s{0,3}(`{3,}|~{3,})/.test(line)){
      if(!inFence){
        findings.push({kind:'fence', line:i+1, evidence:line.trim().slice(0,20)});
        inFence=true;
        continue;
      } else { inFence=false; continue; }
    }
    if(inFence) continue;
    var m;
    if(m=/^(#{1,6})([^ #\t]|$)/.exec(line)){
      if(m[2]) findings.push({kind:'hash-no-space', line:i+1, evidence:line.slice(0,24)});
    }
    if(/[A-Za-z0-9]_[A-Za-z0-9]/.test(line))
      findings.push({kind:'intraword-underscore', line:i+1, evidence:line.trim().slice(0,28)});
    if(m=/^\s{0,3}(\d{1,9})\)\s/.exec(line))
      findings.push({kind:'ordered-paren', line:i+1, evidence:m[1]+')'});
    if(m=/^\s{0,3}(\d{1,9})\.\s/.exec(line)){
      var n=parseInt(m[1],10);
      var prev=i>0?lines[i-1]:'';
      var prevIsText = prev.trim()!=='' && !/^\s{0,3}([-*+]|\d+[.)])\s/.test(prev) && !/^\s{0,3}(#{1,6}|>|`{3,}|~{3,})/.test(prev);
      if(prevIsText)
        findings.push({kind: n===1?'ordered-interrupt-1':'ordered-interrupt-2plus', line:i+1, evidence:m[1]+'.'});
      else if(n!==1)
        findings.push({kind:'ordered-start', line:i+1, evidence:'starts at '+n});
    }
    if(m=/(^|[\s(])((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?])/.exec(line))
      findings.push({kind:'bare-url', line:i+1, evidence:m[2].slice(0,32)});
    if(/~~[^~]+~~/.test(line))
      findings.push({kind:'strikethrough', line:i+1, evidence:line.trim().slice(0,24)});
    if(i+1<lines.length && /\|/.test(line) && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i+1]) && /\|/.test(lines[i+1]))
      findings.push({kind:'table', line:i+1, evidence:line.trim().slice(0,28)});
    if(i>0 && /^ {1,3}[-*+]\s/.test(line) && /^\s{0,3}[-*+]\s/.test(lines[i-1]||''))
      findings.push({kind:'sublist-indent-2', line:i+1, evidence:line.trim().slice(0,20)});
    if(/^\s*[-*+]\s+\[[ xX]\]\s/.test(line))
      findings.push({kind:'task-list', line:i+1, evidence:line.trim().slice(0,24)});
  }
  return findings;
}

function findings(input){
  var lines=String(input||'').replace(/\r\n?/g,'\n').split('\n');
  return detect(lines).map(function(f){
    var c=CONSTRUCTS[f.kind];
    return {kind:f.kind, line:f.line, evidence:f.evidence, name:c.name,
            explain:c.explain, outcomes:c.outcomes};
  });
}

return {CONSTRUCTS:CONSTRUCTS, findings:findings};
});
