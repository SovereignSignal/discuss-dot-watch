import {plainText} from './corpusPolicy';
import {isAllowedUrl} from './url';
/** Preserve source-owned application links after HTML sanitization. Body limits
 * are enforced by the corpus writer, where truncation can be recorded honestly. */
export function sourceText(html:string){
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1].replace(/&amp;/g,'&')).filter(url=>isAllowedUrl(url)).slice(0,30);
  const text=plainText(html),unique=[...new Set(links)].filter(url=>!text.includes(url));
  return text+(unique.length?'\nSource links:\n'+unique.join('\n'):'');
}
