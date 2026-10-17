import path from 'node:path';
import fs from 'node:fs/promises';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

/**
 * Standard Guardrail Categories
 */
export const GUARDRAIL_CATEGORIES = {
  SEXUAL_CONTENT: {
    id: 'SEXUAL_CONTENT',
    label: 'Sexual & Explicit Content',
    description: 'Pornography, sexually explicit text, erotica, sexual acts, adult solicitation, and non-consensual sexual material.',
    refusalMessage: 'This request was blocked by content safety guardrails. Content involving sexual, explicit, or adult material is strictly prohibited.',
  },
  HATE_SPEECH: {
    id: 'HATE_SPEECH',
    label: 'Hate Speech & Discrimination',
    description: 'Slurs, dehumanizing language, incitement to discrimination or violence against protected groups based on race, religion, sexual orientation, disability, or nationality.',
    refusalMessage: 'This request was blocked by content safety guardrails. Hate speech, discrimination, and derogatory attacks against protected groups are strictly prohibited.',
  },
  HARASSMENT_AND_ABUSE: {
    id: 'HARASSMENT_AND_ABUSE',
    label: 'Harassment & Abuse',
    description: 'Targeted harassment, personal threats, doxxing, swatting, extortion, and cyberstalking.',
    refusalMessage: 'This request was blocked by content safety guardrails. Harassment, threats, stalking, and abusive conduct are strictly prohibited.',
  },
  VIOLENCE_AND_HARM: {
    id: 'VIOLENCE_AND_HARM',
    label: 'Violence, Gore & Self-Harm',
    description: 'Graphic violence, gore, mutilation, suicide encouragement, self-harm instructions, and glorification of mass casualty attacks.',
    refusalMessage: 'This request was blocked by content safety guardrails. Depictions of graphic violence, gore, self-harm, and suicide are strictly prohibited.',
  },
  DANGEROUS_CONTENT: {
    id: 'DANGEROUS_CONTENT',
    label: 'Dangerous, Illegal & Malicious Content',
    description: 'Instructions for making improvised explosive devices, chemical/biological weapons, illicit lethal drug manufacturing, and malware/cyberattack exploits.',
    refusalMessage: 'This request was blocked by content safety guardrails. Instructions or material related to dangerous, illegal, or malicious activities (such as weapons, malware, or illicit substances) are strictly prohibited.',
  },
  HUMAN_SECURITY_AND_PUBLIC_SAFETY: {
    id: 'HUMAN_SECURITY_AND_PUBLIC_SAFETY',
    label: 'Human Security, Critical Infrastructure & Public Safety',
    description: 'Sabotage of critical infrastructure (power grid, water supply, nuclear facilities, transit), human trafficking, kidnapping, chemical/biological/radiological threats, and medical system tampering.',
    refusalMessage: 'This request was blocked by content safety guardrails. Content posing risks to human security, public safety, or critical infrastructure is strictly prohibited.',
  },
  PROMPT_INJECTION: {
    id: 'PROMPT_INJECTION',
    label: 'Prompt Injection & Jailbreak Attempts',
    description: 'Adversarial jailbreaks and prompt injection attempts designed to bypass or subvert AI safety instructions.',
    refusalMessage: 'This request was blocked by content safety guardrails. System override, prompt injection, and jailbreak attempts are strictly prohibited.',
  },
};

/**
 * Custom Error for safety guardrail violations
 */
export class SafetyGuardrailError extends Error {
  constructor(message, { category = 'GENERAL', violations = [], details = null } = {}) {
    super(message);
    this.name = 'SafetyGuardrailError';
    this.status = 400;
    this.safetyBlocked = true;
    this.category = category;
    this.violations = violations;
    this.details = details;
  }
}

/**
 * Text normalizer for evasion detection:
 * - Unicode NFKD decomposition
 * - Strip zero-width & non-printable characters
 * - Normalize leetspeak substitutions
 * - Collapse single-letter spaced words (e.g., "p o r n" -> "porn")
 */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';

  let normalized = text
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .toLowerCase();

  // Substitute common leetspeak characters
  const leetMap = {
    '@': 'a',
    '4': 'a',
    '8': 'b',
    '3': 'e',
    '1': 'i',
    '!': 'i',
    '0': 'o',
    '$': 's',
    '5': 's',
    '7': 't',
    '+': 't',
  };

  const deLeeted = normalized
    .split('')
    .map((char) => leetMap[char] || char)
    .join('');

  // Replace underscores and hyphens with spaces for boundary matching (e.g. "hardcore_pornography_leak.txt")
  const delimiterCleaned = normalized.replace(/[_\-/\\.]+/g, ' ');

  // Collapse single letters separated by spaces or punctuation: "p.o.r.n" or "p o r n" -> "porn"
  const collapsedSpaced = normalized.replace(/\b([a-z0-9])\s+([a-z0-9])\s+([a-z0-9])\s+([a-z0-9])\b/gi, '$1$2$3$4')
    .replace(/\b([a-z0-9])\s+([a-z0-9])\s+([a-z0-9])\b/gi, '$1$2$3')
    .replace(/([a-z0-9])[.\-_*~]+([a-z0-9])[.\-_*~]+([a-z0-9])[.\-_*~]+([a-z0-9])/gi, '$1$2$3$4');

  return {
    original: text,
    normalized,
    deLeeted,
    delimiterCleaned,
    collapsed: collapsedSpaced,
  };
}

/**
 * Category Pattern Definitions
 */
const PATTERNS = {
  SEXUAL_CONTENT: [
    // Zero-tolerance CSAM / Pedophilia
    {
      regex: /\b(pedophil\w*|paedophil\w*|child porn\w*|lolita|underage sex|sex with (child|minor|children)|csam|csae)\b/i,
      reason: 'Child sexual exploitation and abuse material is strictly prohibited.',
    },
    // Explicit pornography, adult content, erotica
    {
      regex: /\b(porn|porno|pornography|pornographic|erotica|erotic novel|erotic story|xxx videos?|hardcore sex|hentai|ecchi|creampie|blowjob|cunnilingus|fellatio|handjob|gangbang|threesome|masturbat\w*|cumshot|orgasm\w*|deepthroat|striptease|sexting|dildo|vibrator|fleshlight|flesh-light)\b/i,
      reason: 'Explicit sexual, adult, or pornographic content detected.',
    },
    // Non-consensual sexual content / rape
    {
      regex: /\b(rape\b|raped|raping|rapist|date rape drug|ghb rape|non-consensual sex|sexual assault)\b/i,
      reason: 'Non-consensual sexual violence or sexual assault is strictly prohibited.',
    },
    // Sex solicitation / escorting
    {
      regex: /\b(hire (a )?(prostitute|escort)|escort service|happy ending massage|buying sex|selling sex|prostitution service)\b/i,
      reason: 'Sexual solicitation and prostitution services are prohibited.',
    },
    // Explicit sexual acts and anatomy combinations
    {
      regex: /\b(penis|vagina|vulva|clitoris|pussy|cock|asshole|dicks?)\b.*\b(suck\w*|lick\w*|thrust\w*|penetrat\w*|ejaculat\w*|orgasm\w*|horny|naked)\b/i,
      reason: 'Sexually explicit acts or anatomical descriptions detected.',
    },
    {
      regex: /\b(suck\w*|lick\w*|thrust\w*|penetrat\w*|ejaculat\w*|orgasm\w*|horny|naked)\b.*\b(penis|vagina|vulva|clitoris|pussy|cock|asshole|dicks?)\b/i,
      reason: 'Sexually explicit acts or anatomical descriptions detected.',
    },
    // Erotic roleplay / requests
    {
      regex: /\b(write (an? )?(erotic|sexual|nsfw|pornographic)|roleplay as my (sexy|naked|horny)|describe sexual (intercourse|acts?)|talk dirty to me)\b/i,
      reason: 'Requests for sexual generation or erotic roleplay are prohibited.',
    },
  ],

  HATE_SPEECH: [
    // Severe racial, ethnic, religious, and homophobic slurs
    {
      regex: /\b(nigger\w*|nigga\w*|kike\w*|chink\w*|gook\w*|spic\w*|faggot\w*|dyke\w*|tranny|trannies|retard\w*)\b/i,
      reason: 'Hate speech, derogatory slurs, or dehumanizing rhetoric detected.',
    },
    // Dehumanization and genocide promotion
    {
      regex: /\b(kill all (jews|blacks|whites|muslims|asians|gays|trans|infidels)|gas the (jews|blacks|muslims)|exterminate (all )?(jews|blacks|muslims|infidels)|white supremacy|neo-nazi|1488|holocaust (was fake|hoax|did not happen))\b/i,
      reason: 'Hate group propaganda, genocide denial/promotion, or hate-fueled violence detected.',
    },
  ],

  HARASSMENT_AND_ABUSE: [
    // Targeted personal threats
    {
      regex: /\b(i (will|am going to) (kill|murder|slit (your|his|her) throat|hunt you down|strangle you|shoot you|stab you))\b/i,
      reason: 'Direct violent threats of physical harm against individuals.',
    },
    // Doxxing & Swatting
    {
      regex: /\b(doxx\w* (him|her|them|someone)|swat\w* (his|her|their) house|leak (his|her|their) home address|swatting)\b/i,
      reason: 'Doxxing, personal intimidation, or swatting is strictly prohibited.',
    },
    // Severe harassment
    {
      regex: /\b(i will stalk you|make your life a living hell|harass (him|her|them) until)\b/i,
      reason: 'Targeted harassment or stalking behavior detected.',
    },
  ],

  VIOLENCE_AND_HARM: [
    // Suicide and self-harm instructions or encouragement
    {
      regex: /\b(how to (commit suicide|kill myself|hang myself|end my life|cut my wrists|slit my wrists|overdose (and|to) die)|suicide method|suicide instruction|ways to die painlessly|encourag\w* suicide|go kill yourself|tell (him|her|them) to kill (himself|herself|themselves))\b/i,
      reason: 'Suicide, self-harm encouragement, or self-harm instructions are strictly prohibited.',
    },
    // Graphic gore & snuff
    {
      regex: /\b(snuff film|beheading video|flaying alive|graphic dismemberment|torture video|decapitation video|gore video)\b/i,
      reason: 'Graphic depictions of extreme violence, torture, or gore are prohibited.',
    },
    // Mass violence
    {
      regex: /\b(school shooting (guide|blueprint|plan)|mass shooting plan|how to carry out a terrorist attack|drive truck into crowd)\b/i,
      reason: 'Planning or glorification of mass casualty attacks and terrorism is prohibited.',
    },
  ],

  DANGEROUS_CONTENT: [
    // Explosives, IEDs, Bombs
    {
      regex: /\b(how to make (a )?(bomb|pipe bomb|molotov cocktail|ied|dynamite|c4|anfo|tnt)|fertilizer bomb recipe|homemade explosive|bomb making (instructions|guide)|blasting cap formula)\b/i,
      reason: 'Instructions for fabricating improvised explosive devices or bombs are strictly prohibited.',
    },
    // Chemical & biological weapons
    {
      regex: /\b(how to (make|synthesize|produce) (ricin|sarin|vx gas|mustard gas|anthrax spores|biological weapon|chemical weapon))\b/i,
      reason: 'Instructions for synthesizing chemical or biological weapons are strictly prohibited.',
    },
    // Illicit narcotics manufacture
    {
      regex: /\b(how to (cook|synthesize|manufacture|make) (crystal meth|methamphetamine|fentanyl|heroin|crack cocaine)|fentanyl synthesis recipe|meth cook recipe)\b/i,
      reason: 'Instructions for the manufacture or synthesis of illicit lethal substances are prohibited.',
    },
    // Malicious cyberattacks & malware creation
    {
      regex: /\b(how to (code|write|create|build) (a )?(ransomware|keylogger|trojan virus|botnet|ddos tool|spyware)|exploit payload to hack|zero-day exploit script|steal credit cards malware)\b/i,
      reason: 'Creation or deployment of malware, ransomware, or cyberattack exploits is prohibited.',
    },
  ],

  HUMAN_SECURITY_AND_PUBLIC_SAFETY: [
    // Critical infrastructure sabotage & municipal attacks
    {
      regex: /\b(sabotage (the )?(power grid|electrical substation|water treatment|nuclear plant|air traffic control)|attack (the )?(power grid|substation)|blow up (a )?(bridge|dam|pipeline))\b/i,
      reason: 'Sabotage or attacks on critical national infrastructure or public utilities are prohibited.',
    },
    {
      regex: /\b(poison\w* (the )?([a-z0-9]+\s+)?(water supply|drinking water|food supply|reservoir)|contaminat\w* (the )?([a-z0-9]+\s+)?(reservoir|municipal water|water supply|drinking water))\b/i,
      reason: 'Deliberate poisoning or chemical/biological contamination of food or municipal water supplies is prohibited.',
    },
    // Transportation & Aviation sabotage
    {
      regex: /\b(derail (a )?train|sabotage (an? )?(airplane|aircraft|commercial flight|runway)|hijack (a )?(plane|flight|train|ship))\b/i,
      reason: 'Sabotage or hijacking of public transit or aviation is strictly prohibited.',
    },
    // Human trafficking, abduction & kidnapping
    {
      regex: /\b(human trafficking|kidnap\w* (a person|someone|a child)|hostage taking|how to abduct (someone|a child)|slave labor trafficking)\b/i,
      reason: 'Human trafficking, child abduction, kidnapping, or hostage-taking is strictly prohibited.',
    },
    // Weapons of mass destruction / CBRN & Radiological dispersal
    {
      regex: /\b(dirty bomb|radiological dispersal device|weaponized (smallpox|ebola|pathogen)|untraceable poison for murder)\b/i,
      reason: 'Radiological, chemical, biological, or weaponized mass casualty materials are strictly prohibited.',
    },
    // Medical device & Life-safety systems tampering
    {
      regex: /\b(hack (a )?(pacemaker|insulin pump|hospital system|icu ventilator|medical device)|tamper with (the )?([a-z0-9]+\s+)*(hospital|medical|pacemaker|ventilator|life support|icu))\b/i,
      reason: 'Tampering with life-safety medical devices or hospital systems is strictly prohibited.',
    },
  ],

  PROMPT_INJECTION: [
    // Adversarial prompt injection & jailbreak patterns
    {
      regex: /\b(ignore (all )?(previous|prior|above) instructions|disregard (all )?(previous|prior) (instructions|rules|guardrails|safety))\b/i,
      reason: 'Prompt injection attempting to override system safety instructions.',
    },
    {
      regex: /\b(you are now (in )?(dan|unfiltered|jailbreak|developer mode|uncensored mode)|dan mode enabled|jailbreak mode)\b/i,
      reason: 'Jailbreak attempt trying to disable ethical boundaries.',
    },
    {
      regex: /\b(bypass (all )?(safety|content|ethical) (filters|guardrails|guidelines)|disable (all )?safety)\b/i,
      reason: 'Explicit request to bypass safety guardrails.',
    },
    {
      regex: /\b(system prompt override|override system rules|roleplay as an? (unrestricted|evil|unfiltered) ai)\b/i,
      reason: 'System override or adversarial roleplay attack detected.',
    },
  ],
};

/**
 * Evaluate arbitrary text against all configured guardrails
 *
 * @param {string} text - Input text (query, chunk, or document excerpt)
 * @param {object} [options]
 * @param {string[]} [options.ignoreCategories] - Optional categories to skip
 * @returns {object} Evaluation result with .allowed, .violations, .primaryViolation, .refusalMessage
 */
export function evaluateGuardrails(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      allowed: true,
      violations: [],
      primaryViolation: null,
      refusalMessage: null,
    };
  }

  const { normalized, deLeeted, delimiterCleaned, collapsed } = normalizeText(text);
  const targets = [text, normalized, deLeeted, delimiterCleaned, collapsed];
  const violations = [];

  for (const [categoryKey, patternList] of Object.entries(PATTERNS)) {
    if (options.ignoreCategories?.includes(categoryKey)) continue;

    const categoryMeta = GUARDRAIL_CATEGORIES[categoryKey] || {
      id: categoryKey,
      label: categoryKey,
      description: 'Prohibited content',
      refusalMessage: 'This request was blocked by content safety guardrails.',
    };

    for (const pattern of patternList) {
      let matched = false;
      let matchedText = '';

      for (const target of targets) {
        const match = pattern.regex.exec(target);
        if (match) {
          matched = true;
          matchedText = match[0];
          break;
        }
      }

      if (matched) {
        violations.push({
          category: categoryKey,
          label: categoryMeta.label,
          reason: pattern.reason,
          matchedSnippet: matchedText.slice(0, 100),
          refusalMessage: categoryMeta.refusalMessage,
        });
        // One hit per category is enough to fail that category
        break;
      }
    }
  }

  const allowed = violations.length === 0;
  const primaryViolation = violations[0] || null;
  const refusalMessage = primaryViolation
    ? primaryViolation.refusalMessage
    : null;

  return {
    allowed,
    violations,
    primaryViolation,
    refusalMessage,
  };
}

/**
 * Assert that text passes guardrails, otherwise throws SafetyGuardrailError
 */
export function assertContentAllowed(text, context = 'Query') {
  const result = evaluateGuardrails(text);
  if (!result.allowed) {
    const primary = result.primaryViolation;
    throw new SafetyGuardrailError(
      `${context} blocked by safety guardrails: ${primary?.reason || 'Prohibited content detected.'}`,
      {
        category: primary?.category || 'PROHIBITED_CONTENT',
        violations: result.violations,
        details: { matchedSnippet: primary?.matchedSnippet },
      }
    );
  }
  return true;
}

/**
 * Inspect uploaded file content (PDF or TXT) before persistence or ingestion.
 * Scans extracted content across all guardrails.
 *
 * @param {string} filePath - Absolute path to uploaded file on disk
 * @param {string} originalName - Original filename
 * @returns {Promise<object>} Inspection result
 */
export async function inspectDocumentFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // 1. Inspect filename itself for bad content
  const filenameCheck = evaluateGuardrails(originalName);
  if (!filenameCheck.allowed) {
    const primary = filenameCheck.primaryViolation;
    return {
      allowed: false,
      violations: filenameCheck.violations,
      primaryViolation: primary,
      error: `Upload rejected by safety guardrails: The filename contains prohibited content (${primary?.label || 'Prohibited Content'}). In accordance with safety policies, this file cannot be processed or stored.`,
    };
  }

  // 2. Extract and inspect document body
  let pages = [];

  try {
    if (ext === '.pdf') {
      const loader = new PDFLoader(filePath);
      const rawDocs = await loader.load();
      pages = rawDocs.map((doc, idx) => ({
        pageNumber: idx + 1,
        content: doc.pageContent || '',
      }));
    } else if (ext === '.txt') {
      const content = await fs.readFile(filePath, 'utf-8');
      pages = [{ pageNumber: 1, content }];
    } else {
      return {
        allowed: false,
        violations: [],
        primaryViolation: null,
        error: `Unsupported file type: ${ext}. Only PDF and TXT are supported.`,
      };
    }
  } catch (err) {
    console.error('[Guardrails] Failed to read file for safety inspection:', err);
    return {
      allowed: false,
      violations: [],
      primaryViolation: null,
      error: `Failed to inspect document content: ${err.message}`,
    };
  }

  if (pages.length === 0 || pages.every((p) => !p.content.trim())) {
    return {
      allowed: false,
      violations: [],
      primaryViolation: null,
      error: 'The uploaded document contains no readable text content.',
    };
  }

  // 3. Scan each page through the guardrail suite
  for (const page of pages) {
    const evaluation = evaluateGuardrails(page.content);
    if (!evaluation.allowed) {
      const primary = evaluation.primaryViolation;
      const pageInfo = pages.length > 1 ? ` on page ${page.pageNumber}` : '';
      return {
        allowed: false,
        pageNumber: page.pageNumber,
        violations: evaluation.violations,
        primaryViolation: primary,
        error: `Upload rejected by safety guardrails: The document contains prohibited content (${primary?.label || 'Prohibited Content'})${pageInfo}. In accordance with safety policies, this file cannot be processed or stored.`,
      };
    }
  }

  // 4. File is clean
  return {
    allowed: true,
    pageCount: pages.length,
    violations: [],
    primaryViolation: null,
    error: null,
  };
}
