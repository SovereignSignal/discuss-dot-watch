import {plainText} from './corpusPolicy';
import {isAllowedUrl} from './url';
/** Preserve application links and keep truncation accounting in the corpus writer.
 * Some native ATS APIs return entity-encoded HTML inside JSON. Decode that one
 * transport layer before sanitizing; otherwise tags become literal corpus text.
 */
export function sourceText(html:string){
  if(!/<[a-z][^>]*>/i.test(html)&&/&lt;\/?(?:p|div|h[1-6]|span|ul|ol|li|a|script|style|br)\b/i.test(html)){
    html=plainText(html);
  }
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1].replace(/&amp;/g,'&')).filter(url=>isAllowedUrl(url)).slice(0,30);
  const text=plainText(html),unique=[...new Set(links)].filter(url=>!text.includes(url));
  return text+(unique.length?'\nSource links:\n'+unique.join('\n'):'');
}
