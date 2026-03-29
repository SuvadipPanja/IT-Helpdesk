// ============================================
// SPELLING CORRECTION SERVICE
// Fixes common IT/helpdesk misspellings
// Uses dictionary + phonetic + edit-distance
// ============================================

class SpellingCorrectionService {

  constructor() {
    // Common IT misspelling dictionary (wrong -> correct)
    this.corrections = {
      // Common words
      'pasword': 'password', 'passwrd': 'password', 'passowrd': 'password', 'passsword': 'password',
      'passward': 'password', 'pasword': 'password', 'pssword': 'password', 'paswword': 'password',
      'paasword': 'password', 'passwoord': 'password', 'passwrod': 'password',
      'emial': 'email', 'emal': 'email', 'e-mal': 'email', 'emaol': 'email', 'emeil': 'email',
      'eamil': 'email', 'emiail': 'email', 'emali': 'email',
      'tickit': 'ticket', 'tiket': 'ticket', 'ticekt': 'ticket', 'tickte': 'ticket',
      'ticked': 'ticket', 'ticcket': 'ticket', 'tuicket': 'ticket', 'tickket': 'ticket',
      'accout': 'account', 'acount': 'account', 'acounts': 'accounts', 'accunt': 'account',
      'accoount': 'account', 'accounnt': 'account', 'accont': 'account',
      'lgin': 'login', 'logn': 'login', 'loggin': 'login', 'loign': 'login', 'lgoin': 'login',
      'configuraton': 'configuration', 'configuartion': 'configuration', 'confguration': 'configuration',
      'configuraiton': 'configuration',
      'computar': 'computer', 'compter': 'computer', 'comuter': 'computer', 'compueter': 'computer',
      'conection': 'connection', 'connction': 'connection', 'connetion': 'connection',
      'connecton': 'connection', 'conexion': 'connection',
      'sofware': 'software', 'softwre': 'software', 'sotfware': 'software', 'softwear': 'software',
      'hadware': 'hardware', 'hardwre': 'hardware', 'hardwear': 'hardware', 'harware': 'hardware',
      'moniter': 'monitor', 'monitr': 'monitor', 'monior': 'monitor',
      'keybord': 'keyboard', 'keyboad': 'keyboard', 'keybaord': 'keyboard', 'kyeboard': 'keyboard',
      'priner': 'printer', 'prnter': 'printer', 'printr': 'printer', 'priinter': 'printer',
      'netwerk': 'network', 'netwrk': 'network', 'nework': 'network', 'newtork': 'network',
      'wirless': 'wireless', 'wirelss': 'wireless', 'wireles': 'wireless',
      'servr': 'server', 'sever': 'server', 'servar': 'server', 'serer': 'server',
      'databse': 'database', 'databas': 'database', 'datbase': 'database', 'dataase': 'database',
      'secuirty': 'security', 'sequrity': 'security', 'secutiry': 'security', 'securty': 'security',
      'instalation': 'installation', 'installtion': 'installation', 'installaion': 'installation',
      'instal': 'install', 'intall': 'install', 'insatll': 'install', 'isntall': 'install',
      'acess': 'access', 'acces': 'access', 'acss': 'access', 'accesss': 'access',
      'permision': 'permission', 'permisson': 'permission', 'permssion': 'permission',
      'autentication': 'authentication', 'authenticaiton': 'authentication',
      'applicaton': 'application', 'appliction': 'application', 'aplication': 'application',
      'dowload': 'download', 'donwload': 'download', 'downlaod': 'download',
      'uplod': 'upload', 'uplaod': 'upload', 'uppload': 'upload',
      'issu': 'issue', 'isue': 'issue', 'isseu': 'issue', 'ishue': 'issue',
      'problm': 'problem', 'probelm': 'problem', 'porblem': 'problem', 'probem': 'problem',
      'eroor': 'error', 'eror': 'error', 'errror': 'error', 'erorr': 'error',
      'mesage': 'message', 'messge': 'message', 'messsage': 'message', 'massege': 'message',
      'notificaton': 'notification', 'notfication': 'notification',
      'recieve': 'receive', 'recive': 'receive', 'recevie': 'receive',
      'respons': 'response', 'resopnse': 'response', 'reponse': 'response',
      'categry': 'category', 'catagory': 'category', 'categary': 'category', 'catogory': 'category',
      'subcategry': 'subcategory', 'subcatagory': 'subcategory',
      'departmnt': 'department', 'deparment': 'department', 'departement': 'department',
      'prioritiy': 'priority', 'priorty': 'priority', 'priortiy': 'priority',
      'asign': 'assign', 'asigne': 'assign', 'assigne': 'assign', 'assgn': 'assign',
      'assignd': 'assigned', 'assigend': 'assigned', 'asigned': 'assigned',
      'resolv': 'resolve', 'resovle': 'resolve', 'reslove': 'resolve',
      'resolvd': 'resolved', 'reolved': 'resolved',
      'updae': 'update', 'updte': 'update', 'uupdate': 'update', 'updaet': 'update',
      'delet': 'delete', 'delte': 'delete', 'deleet': 'delete',
      'craete': 'create', 'crate': 'create', 'creat': 'create', 'ceate': 'create',
      'repot': 'report', 'reoprt': 'report', 'repoort': 'report',
      'staus': 'status', 'stauts': 'status', 'sttaus': 'status', 'stattus': 'status',
      'escalaton': 'escalation', 'escallation': 'escalation', 'escaltion': 'escalation',
      'managr': 'manager', 'maneger': 'manager', 'mangaer': 'manager',
      'engeneer': 'engineer', 'enginer': 'engineer', 'enginear': 'engineer',
      'dashbord': 'dashboard', 'dashoard': 'dashboard', 'dasboard': 'dashboard',
      'settins': 'settings', 'setings': 'settings', 'sttings': 'settings',
      'systm': 'system', 'sytem': 'system', 'ssytem': 'system',
      'vpan': 'vpn', 'vpm': 'vpn',
      'wfi': 'wifi', 'wify': 'wifi', 'wi-if': 'wifi',
      'blutooth': 'bluetooth', 'bluetoth': 'bluetooth', 'bluethooth': 'bluetooth',
      'outllook': 'outlook', 'outlok': 'outlook', 'outloook': 'outlook',
      'broswr': 'browser', 'broswer': 'browser', 'brower': 'browser',
      'chrom': 'chrome', 'crome': 'chrome', 'chorme': 'chrome',
      'fierfox': 'firefox', 'firfox': 'firefox',
      'widows': 'windows', 'windwos': 'windows', 'windos': 'windows',
      'liscense': 'license', 'lisence': 'license', 'licence': 'license',
      'backp': 'backup', 'bakcup': 'backup', 'bakup': 'backup',
      'resotre': 'restore', 'resore': 'restore', 'restroe': 'restore',
      'rebooot': 'reboot', 'rebot': 'reboot', 'rebbot': 'reboot',
      'shutdwon': 'shutdown', 'shutdwn': 'shutdown', 'shtudown': 'shutdown',
      'antivrus': 'antivirus', 'antivius': 'antivirus', 'anitviurs': 'antivirus',
      'firwall': 'firewall', 'firewal': 'firewall', 'firewll': 'firewall',
      'encription': 'encryption', 'encyrption': 'encryption', 'ecryption': 'encryption',
      'certificte': 'certificate', 'certiifcate': 'certificate', 'certficate': 'certificate',
      'attchment': 'attachment', 'attachemnt': 'attachment', 'attahcment': 'attachment',
      'filtaring': 'filtering', 'filering': 'filtering', 'filtring': 'filtering',
      'curentaly': 'currently', 'currenly': 'currently', 'curently': 'currently',
      'senerio': 'scenario', 'senario': 'scenario', 'scenerio': 'scenario',
      'quary': 'query', 'querry': 'query', 'quey': 'query',
      'spaling': 'spelling', 'speling': 'spelling', 'spellig': 'spelling',
      'reamber': 'remember', 'remeber': 'remember', 'rember': 'remember',
      'prefrance': 'preference', 'preferance': 'preference', 'preferace': 'preference',
      'intrinal': 'internal', 'interal': 'internal', 'intrnal': 'internal',
      'powerfull': 'powerful', 'poweful': 'powerful',
      'sesion': 'session', 'sesson': 'session', 'sessoin': 'session',
      'helpdsk': 'helpdesk', 'hlepdesk': 'helpdesk', 'heldesk': 'helpdesk',
    };

    // Build reverse index for fast lookup
    this.knownWords = new Set([
      ...Object.values(this.corrections),
      // IT terms
      'password', 'reset', 'email', 'ticket', 'account', 'login', 'logout',
      'computer', 'software', 'hardware', 'network', 'printer', 'monitor',
      'keyboard', 'mouse', 'server', 'database', 'security', 'install',
      'access', 'permission', 'authentication', 'application', 'download',
      'upload', 'issue', 'problem', 'error', 'message', 'notification',
      'category', 'subcategory', 'department', 'priority', 'assign',
      'resolve', 'update', 'delete', 'create', 'report', 'status',
      'escalation', 'manager', 'engineer', 'dashboard', 'settings',
      'system', 'vpn', 'wifi', 'bluetooth', 'outlook', 'browser',
      'chrome', 'firefox', 'windows', 'license', 'backup', 'restore',
      'reboot', 'shutdown', 'antivirus', 'firewall', 'encryption',
      'certificate', 'attachment', 'helpdesk', 'ticket', 'filter',
      'assign', 'assigned', 'resolved', 'escalated', 'breached',
      // Common English words (MUST include to prevent false corrections)
      'help', 'support', 'how', 'what', 'when', 'where', 'why', 'which',
      'can', 'will', 'the', 'is', 'my', 'not', 'working', 'work',
      'unable', 'cannot', 'slow', 'fast', 'broken', 'fix', 'new', 'old',
      'change', 'need', 'want', 'please', 'thanks', 'thank', 'hello',
      'hi', 'hey', 'good', 'bad', 'open', 'close', 'closed', 'pending',
      'urgent', 'critical', 'high', 'medium', 'low', 'normal', 'sla',
      // Words that were being incorrectly corrected
      'last', 'latest', 'first', 'next', 'past', 'recent', 'show',
      'find', 'check', 'view', 'look', 'tell', 'about', 'track',
      'give', 'make', 'take', 'have', 'been', 'does', 'done', 'just',
      'also', 'very', 'much', 'many', 'some', 'more', 'most', 'only',
      'same', 'time', 'date', 'name', 'type', 'role', 'user', 'team',
      'list', 'from', 'into', 'with', 'this', 'that', 'them', 'then',
      'than', 'they', 'their', 'there', 'here', 'your', 'ours', 'each',
      'both', 'such', 'like', 'back', 'been', 'come', 'came', 'goes',
      'went', 'send', 'sent', 'read', 'call', 'know', 'knew', 'keep',
      'kept', 'left', 'right', 'still', 'even', 'over', 'under',
      'after', 'before', 'again', 'other', 'another', 'every',
      'could', 'would', 'should', 'might', 'shall', 'must',
      'start', 'stop', 'test', 'link', 'page', 'file', 'form',
      'save', 'load', 'move', 'copy', 'edit', 'sort', 'search',
      'print', 'scan', 'lock', 'logs', 'port', 'disk', 'drive',
      'mail', 'chat', 'talk', 'text', 'note', 'alert', 'info',
      'data', 'site', 'code', 'host', 'path', 'mode', 'tool',
      'able', 'used', 'using', 'gets', 'give', 'gave', 'says',
      'said', 'turn', 'runs', 'real', 'sure', 'okay', 'fine',
      'down', 'wait', 'long', 'full', 'size', 'area', 'part',
      'plan', 'cost', 'free', 'paid', 'auto', 'manual',
      // Plural/abbreviation forms that fuzzy-match incorrectly without this list
      'stats', 'tickets', 'statistics', 'analytics', 'summary',
      'summaries', 'accounts', 'errors', 'issues', 'problems',
    ]);
  }

  /**
   * Correct an entire message
   * @param {string} message - Raw user message
   * @returns {{ corrected: string, corrections: Array<{original: string, corrected: string}>, wasCorrected: boolean }}
   */
  correctMessage(message) {
    if (!message || typeof message !== 'string') {
      return { corrected: message || '', corrections: [], wasCorrected: false };
    }

    const corrections = [];
    
    // Split into tokens, preserving punctuation
    const corrected = message.replace(/\b([a-zA-Z]+)\b/g, (match) => {
      const lower = match.toLowerCase();
      
      // Skip very short words
      if (lower.length <= 2) return match;
      
      // Check direct dictionary
      if (this.corrections[lower]) {
        const fixed = this.corrections[lower];
        corrections.push({ original: match, corrected: fixed });
        // Preserve original casing style
        return this._matchCase(match, fixed);
      }

      // If word is known, skip
      if (this.knownWords.has(lower)) return match;

      // Try fuzzy match against known words
      const fuzzyMatch = this._fuzzyFind(lower);
      if (fuzzyMatch) {
        corrections.push({ original: match, corrected: fuzzyMatch });
        return this._matchCase(match, fuzzyMatch);
      }

      return match;
    });

    return {
      corrected,
      corrections,
      wasCorrected: corrections.length > 0
    };
  }

  /**
   * Fuzzy find a match in known words  
   * Uses Levenshtein distance with threshold
   */
  _fuzzyFind(word) {
    if (word.length < 4) return null;

    let bestMatch = null;
    let bestDistance = Infinity;
    const threshold = word.length <= 5 ? 1 : 2;

    for (const known of this.knownWords) {
      // Quick length check - skip if too different
      if (Math.abs(known.length - word.length) > threshold) continue;

      const dist = this._levenshtein(word, known);
      if (dist <= threshold && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = known;
        if (dist === 1) break; // Good enough
      }
    }

    return bestMatch;
  }

  /**
   * Levenshtein distance between two strings
   */
  _levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,       // deletion
          dp[i][j - 1] + 1,       // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
        // Transposition (Damerau)
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
        }
      }
    }
    return dp[m][n];
  }

  /**
   * Match the casing style of the original word
   */
  _matchCase(original, replacement) {
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }
}

module.exports = new SpellingCorrectionService();
